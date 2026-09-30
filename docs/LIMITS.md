# Real, simulated and unproven

Real execution: Nirium Agent, x402 fetch/client/exact scheme, Stellar
AssembledTransaction construction and signAuthEntries, XDR and Ed25519. V8
coverage and per-case assertions record the path. No whole-path mocks replace
these implementations.

Simulated APIs: `globalThis.fetch` for merchant 402/paid responses;
`rpc.Server.getLatestLedger`, `rpc.Server.simulateTransaction` and
`Horizon.Server.ledgers`. RPC simulation returns fixture authorization entries
built with real XDR from the real transaction invocation; it does not execute
Soroban. Policy, version state, time and exposure are controlled test fixtures.
The administrative test injects XDR at the boundary because exact only expresses
transfer. It does not execute an admin operation via x402Fetch.

There is no merchant, remote RPC, Horizon service, facilitator or network account
in G1. Signatures and signed payloads stay in test memory; exported ledgers contain
only unsigned context, hashes, counts and outcomes. The harness blocks socket,
HTTP/S, TLS, DNS, datagram and unknown fetch entrypoints and blocks sendTransaction.
Its separate self-check intentionally invokes these blocked entrypoints without
physical I/O. This is not an OS sandbox; it is not proof against malicious native
extensions or code deliberately avoiding the interceptors.

The original upstream regression includes its existing x402Serve/guard mocks
and local WebSocket tests. These are baseline regression, not added MPP or
x402Serve qualification. Only localhost WebSocket I/O is used by that baseline.
Preparation needs public GitHub/npm; blockchain RPC/broadcast remains prohibited.

L01: two reads can each see 400 and authorize 300. Reads do not reserve capacity.
L02: holding the raw signer permits bypassing the in-process adapter. The test
uses a direct reference; it does not exercise an independent process or G2.
G2 NOT_RUN; G3 NOT_SOLVED; G4 NOT_RUN. No claim uses KINE/ANANKE evidence.

Legacy authorization preimages lack a separate credential-address field. The
composition checks transfer.from, configured/options address and public-key
verification. Other preimage formats, delegated accounts, contract signatures,
arbitrary subtree economic semantics and owner authentication are not qualified.
The version observation can become stale after it is read, and a signer can be
asynchronous. This package does not eliminate every TOCTOU window. Policy
revocation after the final check and execution-time enforcement remain unproven.
