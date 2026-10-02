# Nirium #96 agent policy harness

Independent public R3 candidate on `r3-1dc5969-public-candidate`.
This review artifact is not authored or endorsed by Nirium and does not imply
upstream merge or adoption. Prepared with OpenAI Codex assistance; see NOTICE.

## R3 / 1dc5969

Target commit: `1dc596932b0b124ad39bb54c4cb00b10c3b08e5e`.
Target tree: `c5552a44c8d386f689eb764617cf89081fbb7b21`.
R3 migrates R2's external policy adapter to the official
`Agent.initX402({ signer: raw, policy })` -> `x402Fetch` hook.
Clean installs must leave the lockfile byte-identical: no normalization or drift.

Expected per platform: 56 Jest + 114 Node = 170 total upstream tests;
34/35 strict R2 correspondence; 35/35 adapted current-hook assertions; zero skips.
The sole strict non-equivalence is G1-SELF-ESCALATION: CONTEXT_MISMATCH before
policy consultation, with zero signer calls. Same no-sign consequence, different
policy semantics. Fifty supplementary diagnostics are separate from the 35 G1 cases.
Seven scoped maintainer fixes were independently verified before publication.
L01 limitation: no concurrent capacity reservation. L02 limitation: same-process
raw signer access or method replacement. Neither is solved.

## Reproduce an exact checkout

Use Node 22.18.0 and npm 10.9.3. Check out the exact candidate commit detached
in a clean clone. Windows requires Windows PowerShell 5.1; WSL uses native Linux
Node and a native Linux filesystem. GitHub/npm access is needed for acquisition.

```powershell
node scripts/verify.cjs
node scripts/publication-audit.cjs
node --test test/integrity.test.cjs test/publication-audit.test.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\VERIFY.ps1 -Results results/<run-id>
```

```sh
node scripts/verify.cjs
node scripts/publication-audit.cjs
node --test test/integrity.test.cjs test/publication-audit.test.cjs
node scripts/run.cjs
node scripts/verify.cjs results/<run-id>
```

Use the result directory printed by the runner. Generated `work/` and `results/`
remain ignored and must not be published: logs can contain local paths.
Real SDK modules and cryptography run against simulated merchant/RPC/Horizon and
policy state, using ephemeral unfunded test keys. No on-chain enforcement is claimed.
See [current contract](docs/REPRODUCIBILITY.md), [R3 findings](docs/R3_1DC5969.md),
[guarantees](docs/GUARANTEES.md) and [limits](docs/LIMITS.md).
`docs/R2_REPAIR.md` is a historical R2 record, not the current contract.
