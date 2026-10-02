# Real execution, simulation and limits

Real: Nirium Agent/official policy hook, x402 fetch/core/exact Stellar scheme,
Stellar assembly, XDR, signAuthEntries/authorizeEntry and Ed25519. Simulated:
merchant challenge/paid response, RPC latest ledger/simulateTransaction, Horizon
ledger times, policy/version/confirmed capacity and clock. No Soroban execution.
Only ephemeral unfunded in-memory test keys; no signed payload export or broadcast.

SELF-ESCALATION uses real x402Fetch with simulated RPC administrative auth.
PREIMAGE-ACCOUNT also uses real x402Fetch plus simulated RPC. PREIMAGE-NETWORK
alone retains the private createPolicyGatedSigner boundary on captured XDR:
auth XDR does not carry a separable networkId that ordinary RPC mutation could
change; the installed SDK derives it locally. That subcase is not public-path
integration. No administrative or governance action executes on-chain.

L01 limitation: independent confirmed-capacity snapshots do not reserve capacity.
L02 limitation: same-process raw signer access/direct calls or replacing
signAuthEntry after gate creation remain possible. There is no account-level or
on-chain enforcement. Final freshness checks are not atomic with signing or
external revision. Legacy preimages lack a separate credential-address binding.
No universal security guarantee or current KINE/Velocity claim is made.

The in-process transport guard is not OS isolation. Upstream regression permits
real localhost WebSockets and blocks remote requests; three attempted fetches to
channels.openzeppelin.com were blocked per qualification run. G1/supplementary
had zero external attempts. Git/npm acquisition uses network separately.
No MPP certification, external policy attestation, settlement or physical tests.
Historical U0 counts are not integration evidence. Generated logs can contain
local paths and must remain private. Private review artifacts are not runtime inputs.
