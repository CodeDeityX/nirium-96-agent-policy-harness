/**
 * REVIEW-ONLY candidate for Nirium #96, agent side.
 *
 * Structural compatibility target: Nirium X402Signer, SDK source commit
 * 96f43ac79df9a19c7783faaefc91b454459139ad, packages/sdk/src/index.ts.
 * Public harness R1 successor: exact-context binding plus bounded freshness.
 * Qualification is limited to the installed path and fixtures in this package.
 *
 * This module checks the decision-to-input binding at a single signer boundary.
 * It does NOT decode XDR, verify signatures, authenticate policy ownership,
 * reserve a shared budget, implement account policies, or constrain a stolen key.
 * The policy reference is a locally enrolled identifier, NOT proof of on-chain
 * policy identity or a mechanism to pin the version used at execution time.
 * An account-specific evaluator is required before real integration.
 */

export interface SignOptions {
  networkPassphrase?: string;
  address?: string;
}
export interface SignatureResult {
  signedAuthEntry: string;
  signerAddress?: string;
}
export interface Signer {
  address: string;
  signAuthEntry(entry: string, opts?: SignOptions): Promise<SignatureResult>;
  signTransaction?: (...args: any[]) => Promise<any>;
}
export interface EvaluationContext {
  readonly schema: 'nirium-pre-sign-input/public-r1';
  readonly requestId: string;
  readonly contextHash: string;
  readonly policyRef: string;
  readonly account: string;
  readonly networkPassphrase: string;
  /** Confidential in production. Never include the full entry in public logs. */
  readonly authEntry: string;
  readonly options: Readonly<Required<SignOptions>>;
}
export interface PolicyDecision {
  readonly kind: 'ALLOW' | 'DENY' | 'WAIT';
  readonly requestId: string;
  readonly contextHash: string;
  readonly policyRef: string;
}
export interface AllowFreshness {
  readonly policyVersion: string;
  /** Unix milliseconds. Equality is expired, not valid. */
  readonly expiresAt: number;
}
export interface PolicySignerConfig {
  signer: Signer;
  networkPassphrase: string;
  policyRef: string;
  /** Explicitly selected by the owner outside this candidate. Not resolved by Nirium. */
  evaluate: (context: EvaluationContext) => Promise<unknown>;
  timeoutMs?: number;
  now: () => number;
  currentPolicyVersion: (context: EvaluationContext, decision: Readonly<AllowFreshness>) => Promise<unknown>;
  freshnessTimeoutMs?: number;
}

export class PolicySignerError extends Error {
  constructor(public readonly code: string) {
    // Intentionally omit raw entries, secrets and unsanitized dependency messages.
    super(code);
    this.name = 'PolicySignerError';
  }
}
const fail = (code: string): never => { throw new PolicySignerError(code); };
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

async function hashParts(parts: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

async function deadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PolicySignerError('POLICY_TIMEOUT')), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Intentionally exposes no administrative method and no signTransaction fallback.
 * Same-process code can still call an independently held raw signer. This is NOT
 * an isolation boundary. Losing this wrapper must not remove account enforcement.
 */
export function createPolicySigner(config: PolicySignerConfig): Readonly<Signer> {
  if (!config || !config.signer || !nonempty(config.signer.address)
      || typeof config.signer.signAuthEntry !== 'function'
      || typeof config.evaluate !== 'function'
      || typeof config.now !== 'function' || typeof config.currentPolicyVersion !== 'function'
      || !nonempty(config.networkPassphrase) || !nonempty(config.policyRef)) {
    fail('INVALID_PROTECTED_CONFIGURATION');
  }
  const timeoutMs = config.timeoutMs ?? 5000;
  const freshnessTimeoutMs = config.freshnessTimeoutMs ?? timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) {
    fail('INVALID_POLICY_TIMEOUT');
  }
  if (!Number.isSafeInteger(freshnessTimeoutMs) || freshnessTimeoutMs <= 0 || freshnessTimeoutMs > 60000) {
    fail('INVALID_FRESHNESS_TIMEOUT');
  }
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    fail('WEBCRYPTO_UNAVAILABLE');
  }

  const account = config.signer.address;
  const networkPassphrase = config.networkPassphrase;
  const policyRef = config.policyRef;
  const evaluate = config.evaluate;
  const now = config.now;
  const currentPolicyVersion = config.currentPolicyVersion;
  const baseSigner = config.signer;
  const sign = baseSigner.signAuthEntry.bind(baseSigner);
  const prefix = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),
    b => b.toString(16).padStart(2, '0')).join('');
  let counter = 0;

  return Object.freeze({
    address: account,
    async signAuthEntry(authEntry: string, opts: SignOptions = {}): Promise<SignatureResult> {
      if (!nonempty(authEntry)) fail('EMPTY_AUTH_ENTRY');
      if (opts === null || typeof opts !== 'object') fail('INVALID_SIGN_OPTIONS');
      if (Object.keys(opts).some(k => k !== 'address' && k !== 'networkPassphrase')) {
        // A new upstream option needs an explicit compatibility decision.
        fail('UNSUPPORTED_SIGN_OPTION');
      }
      if (opts.address !== undefined && opts.address !== account) fail('ACCOUNT_MISMATCH');
      if (opts.networkPassphrase !== undefined && opts.networkPassphrase !== networkPassphrase) {
        fail('NETWORK_MISMATCH');
      }
      const options = Object.freeze({ address: account, networkPassphrase });
      const requestId = `${prefix}:${++counter}`;
      const contextHash = await hashParts([
        'nirium-pre-sign-input/public-r1', requestId, policyRef, account,
        networkPassphrase, authEntry,
      ]);
      const context: EvaluationContext = Object.freeze({
        schema: 'nirium-pre-sign-input/public-r1', requestId, contextHash, policyRef,
        account, networkPassphrase, authEntry, options,
      });

      let answer: unknown;
      try {
        // Promise.resolve().then also captures synchronous evaluator failures.
        answer = await deadline(Promise.resolve().then(() => evaluate(context)), timeoutMs);
      } catch (error) {
        if (error instanceof PolicySignerError && error.code === 'POLICY_TIMEOUT') throw error;
        fail('POLICY_UNAVAILABLE');
      }
      if (!answer || typeof answer !== 'object') fail('INVALID_POLICY_DECISION');
      const rawDecision = answer as Partial<PolicyDecision & AllowFreshness>;
      // Snapshot primitive decision fields before awaiting freshness. Subsequent
      // mutation of a provider-owned object cannot extend this decision.
      const decision = Object.freeze({kind: rawDecision.kind, requestId: rawDecision.requestId,
        contextHash: rawDecision.contextHash, policyRef: rawDecision.policyRef,
        policyVersion: rawDecision.policyVersion, expiresAt: rawDecision.expiresAt});
      if (decision.requestId !== requestId || decision.contextHash !== contextHash
          || decision.policyRef !== policyRef) {
        fail('DECISION_BINDING_MISMATCH');
      }
      if (decision.kind === 'DENY') fail('POLICY_DENIED');
      if (decision.kind === 'WAIT') fail('POLICY_WAIT');
      if (decision.kind !== 'ALLOW') fail('INVALID_POLICY_DECISION');
      if (!nonempty(decision.policyVersion) || decision.policyVersion.trim().length === 0
          || typeof decision.expiresAt !== 'number' || !Number.isSafeInteger(decision.expiresAt)) {
        fail('INVALID_POLICY_DECISION');
      }
      const freshness: Readonly<AllowFreshness> = Object.freeze({
        policyVersion: decision.policyVersion as string, expiresAt: decision.expiresAt as number,
      });
      const checkExpiry = (): void => {
        let time: number;
        try { time = now(); } catch { return fail('POLICY_FRESHNESS_UNAVAILABLE'); }
        if (!Number.isSafeInteger(time) || time < 0) fail('POLICY_FRESHNESS_UNAVAILABLE');
        if (time >= freshness.expiresAt) fail('POLICY_DECISION_EXPIRED');
      };
      checkExpiry();
      let current: unknown;
      try {
        current = await deadline(Promise.resolve().then(() => currentPolicyVersion(context, freshness)), freshnessTimeoutMs);
      } catch { fail('POLICY_FRESHNESS_UNAVAILABLE'); }
      if (!nonempty(current) || current.trim().length === 0) fail('POLICY_FRESHNESS_UNAVAILABLE');
      if (current !== freshness.policyVersion) fail('POLICY_VERSION_STALE');
      // Final tested freshness boundary: no asynchronous work before invoking
      // the signer. This read/check is NOT atomic with signing or execution.
      checkExpiry();
      if (baseSigner.address !== account) fail('SIGNER_IDENTITY_CHANGED');

      let result: SignatureResult;
      try {
        result = await sign(authEntry, { ...options });
      } catch {
        // A throw after calling the signer does not prove no signature exists.
        // Never retry or release any external reservation automatically here.
        throw new PolicySignerError('SIGNER_OUTCOME_UNKNOWN');
      }
      if (!result || !nonempty(result.signedAuthEntry)) fail('SIGNER_RESULT_INVALID');
      // Output is returned unchanged. Parsing/validating the signed XDR and any
      // account-specific signerAddress convention remains an integration task.
      return result;
    },
  });
}
