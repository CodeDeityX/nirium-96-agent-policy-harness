# Tested G1 boundary

The generic adapter hashes the exact encoded preimage, unique request identity,
policy reference, signer account and expected network. Only a decision matching
all request-binding fields can progress. DENY, WAIT, provider error or timeout
cannot invoke the underlying signer. Late ALLOW is ignored.

ALLOW additionally requires a nonempty `policyVersion` and finite safe-integer
`expiresAt` (Unix milliseconds). Decision fields are copied before awaiting
freshness. Expiry is tested both before and after the awaited version observation;
`now >= expiresAt` fails with `POLICY_DECISION_EXPIRED`. A different current
version fails with `POLICY_VERSION_STALE`. An error, timeout or invalid version
fails with `POLICY_FRESHNESS_UNAVAILABLE`. An invalid clock also fails closed.
Missing decision metadata is `INVALID_POLICY_DECISION`.

The caller supplies `now()` and `currentPolicyVersion(context, decision)`.
There is no default remote backend and no invented Nirium hook. The source is
expected to resolve the policy identified by context.policyRef. Its truth and
authority are not independently proven by these tests. The final check invokes
no further asynchronous operation before calling the signer, but it is not
atomic with that signer, external policy updates, or account execution.

The Stellar composition decodes a legacy authorization `HashIdPreimage` using
the **16.2.0 SDK actually resolved by installed @x402/stellar**. It extracts the
network hash, from/to, asset, exact i128 amount, nonce, expiration ledger and
invocation XDR. The final returned SEP-43 value is a 64-byte Ed25519 signature,
not signed-entry XDR. It is verified over the exact approved preimage. The
in-memory merchant checks the resulting actual x402 transaction payload again.

Policy `expiresAt` is distinct from the Stellar authorization's expiration
ledger: it gates issuance locally and does not shorten or revoke an authorization
after signing. Current policy-version comparison provides no pending-capacity
reservation and no receipt/signature attestation by a policy authority.

New required cases A–E use injected clocks and deterministic promise barriers.
Additional cases check missing metadata, expiry during the version observation,
an unresolved source and an invalid source value. The original timeout cases
exercise actual timer deadlines; the new version/expiry cases do not depend on
wall-clock sleeps. L01 and L02 remain expected counterexamples.
