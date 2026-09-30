# Nirium #96: agent policy harness (private R2 repair candidate)

This public review candidate reproduces a bounded agent-side pre-sign policy
check using the **real installed Nirium/x402 path**. It is not an official Nirium
hook, an adopted integration, or account-level enforcement. Nothing is published
by running it. The official supported pre-sign hook remains future maintainer work.

## One-command reproduction

R2 changes delivery integrity and platform launch only. Qualification results belong
to the separate private review package; this source file does not assert a completed
Windows, Linux or WSL run. Preserve the source manifest when reproducing.

Prerequisites: Node.js **22.18.0**, npm **10.9.3**, native Git, and write access.
Windows requires actual Windows PowerShell **5.1**. Linux needs no PowerShell;
use a native Linux filesystem and native Linux tools (including inside WSL).
GitHub and registry.npmjs.org must be reachable for preparation. No wallet,
credentials, private repository, previous ZIP or blockchain funds are needed.
Versions are checked exactly. No support for every Node 22 or Linux distro is claimed.

From this folder:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN.ps1
```

On Linux, from the candidate folder run:

```sh
node scripts/run.cjs
```

For a completed successful regression, expect exit 0, `PASS: upstream 58; G1 35 including 10 freshness cases`, and a new
`results/<timestamp>/summary.json`. Exit nonzero is a blocker, not a partial PASS.
Keep failed result folders. The command clones and checks the exact commit,
verifies source/dependency identity, installs, builds, runs upstream tests,
compiles the local adapter, tests the network guard and runs all G1 cases.
Every invocation uses a new clone and an empty, local npm cache; it never borrows
an old node_modules directory. Allow disk space and network time for each run.

Upstream: https://github.com/nirium-protocol/nirium.git

Pinned commit: `96f43ac79df9a19c7783faaefc91b454459139ad`.

Installation is exactly `npm install --no-audit --no-fund --legacy-peer-deps`,
the mode in that commit's SDK CI. The workflow documents a pre-existing MPP peer
mismatch. This reproduces CI parity; it does **not** fix or certify MPP. No force
flag or dependency declaration edit is used. npm's two root-version lockfile
changes (0.14.1 to 0.15.0) are recorded separately from production source changes.
Unexpected drift fails closed. `config/upstream.json` pins hashes and actual
resolved versions, including Stellar SDK 14.6.1 at root and **16.2.0 under x402**.

## What runs

Real: `Agent.initX402({signer})`, `Agent.x402Fetch`, installed @x402/fetch,
@x402/core, @x402/stellar ExactStellarScheme, Stellar's transaction/auth structure
construction, XDR decoding, Ed25519 signing and verification.

Simulated: merchant HTTP responses, RPC latest-ledger and transaction simulation,
Horizon ledger times, policy and confirmed exposure. See [LIMITS](docs/LIMITS.md).
Test keys are randomly generated, ephemeral, in memory and unfunded. No real
private keys, wallets or funded accounts are loaded. Signed payloads remain in
memory. No transaction is broadcast. The network guard is an **in-process test
control**, not an operating-system sandbox against hostile code.

The 25 predecessor G1 cases are retained, including L01/L02 counterexamples.
The ten retained freshness cases bring this candidate to **35 G1 cases**. The historical
58 upstream / 25 G1 / 24 isolated U0 results remain historical; U0 is not rerun
or counted as integration here. The new upstream baseline is run independently.

## Bounded stale-ALLOW property

An ALLOW must match the exact request and contain a nonempty policyVersion and
an explicit expiresAt in Unix milliseconds. The adapter snapshots those fields,
checks expiry, awaits an explicitly injected current-version source, checks its
result against the decision version, and rechecks expiry immediately before
invoking the signer. Equality with expiresAt is expired. Source failure, malformed
version or source timeout fail closed. Time is an explicitly injected clock.

Within the tested Nirium/x402 pre-sign path, an ALLOW is bound to the exact
request, the policy version under which it was produced, and an explicit expiry.
The adapter fails closed if the decision is expired or the policy version is no
longer current at the final pre-sign freshness check. This does not establish
atomic account-level revocation or execution-time enforcement.

The version read and expiry check are **not atomic with cryptographic signing**.
The source can change after its observation or while a signer is running. An
already emitted authorization remains possible. A trusted, sufficiently fresh
source and clock are assumptions; this harness does not authenticate policy
ownership or certify the source. See [GUARANTEES](docs/GUARANTEES.md).

## Results and limits

Each timestamped result folder contains versions, workflow, source hashes,
before/after lockfiles, raw logs and exit codes, expected/actual comparison,
per-case ledger, network events, V8 coverage, production diff, worktree status,
summary and SHA256SUMS. Expected outcomes are in `expected/expected-results.json`.
Assertions are not disabled to preserve a preferred count.

```text
L01_PENDING_CAPACITY_RESERVATION = NOT_SOLVED
L02_OUT_OF_PROCESS_SIGNER_BYPASS = NOT_SOLVED
G2_ONCHAIN_ENFORCEMENT = NOT_RUN
G3_PENDING_CAPACITY = NOT_SOLVED
G4_GOVERNANCE = NOT_RUN
```

Self-escalation is administrative XDR injected at the adapter boundary; exact
x402 only produces transfer. It is not G4 or proof of rejection by a contract.
No KINE/ANANKE access, official hook implementation, MPP behavior qualification,
deployment, commit, push, PR, GitHub comment or publication is performed.

For integrity verification, run `powershell.exe -NoProfile -ExecutionPolicy
Bypass -File .\VERIFY.ps1 -Results .\results\<timestamp>` on one line. Verification
checks file integrity and recorded verdict; it does not rerun tests. More details:
[REPRODUCIBILITY](docs/REPRODUCIBILITY.md), [AI assistance](docs/AI_ASSISTANCE.md).

## R2 source integrity

See [R2 repair and trust boundary](docs/R2_REPAIR.md). Run the separate controls
with `node --test test/integrity.test.cjs`; they do not install dependencies or
add G1 cases. Run `node scripts/verify.cjs` for raw source verification on Linux.
An unsigned manifest establishes consistency, not publisher identity.
