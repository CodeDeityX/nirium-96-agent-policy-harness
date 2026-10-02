# Current tested R3 boundary

The acceptance authority is the official `initX402({ signer: raw, policy })`
hook on the real `x402Fetch` path, not the former generic adapter. The passive
compatibility view renames context data without deciding policy. contextHash
binds URL, method and authorization preimage hash; the decision must echo it.
There is no official requestId or policyRef. `policy.evaluate(ctx,{signal})`
returns decision/contextHash/policyVersion/expiresAt. `currentVersion(ctx,{signal})`
receives no decision. `requireExpiry = true`; one timeoutMs covers evaluation and
version lookup, capped at half maxTimeoutSeconds. Expiry is distinct from ledger
expiration and cannot revoke a signature already issued.

Observed refusal outcomes: DENY, WAIT, ENGINE_ERROR, TIMEOUT, UNBOUND, MALFORMED,
EXPIRED (including missing expiry), STALE, VERSION_UNAVAILABLE, SIGNER_CHANGED,
CLOCK_INVALID, CONTEXT_MISMATCH and SIGNER_ERROR for unusable signer results.
Finite clock validation applies to each read. Final version lookup, clock and
address checks follow the ALLOWED observer. No await occurs between the final
checks and invoking the signer; signing and policy changes are still not atomic.

`onDecision` receipts: ALLOWED is a notice before final checks, not completed
authorization; SIGNED means a nonempty returned signedAuthEntry string, NOT
cryptographic validity; SIGNER_ERROR records rejection/throw/unusable result.
Signer errors can follow local generation before a throw. Rejected/pending
observer promises are not awaited and their rejections are consumed. This does
not isolate hostile same-process code or bound synchronous CPU work.

Installed Stellar SDK 16.3.0 verifies returned signature bytes against the
preimage; tamper cases produce plain Error downstream. The gate does not perform
that cryptographic verification. Signer-thrown errors remain plain Error through
x402; missing/invalid returned signature gives X402PolicyError/SIGNER_ERROR.
L01 and L02 are intentional limitations, not solved guarantees. See LIMITS.
