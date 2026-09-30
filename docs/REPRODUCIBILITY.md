# R2 reproduction contract

Modified for R2 delivery repair. Use the exact Node 22.18.0 / npm 10.9.3 pins.
Windows: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN.ps1
Linux: node scripts/run.cjs
The common runner resolves npm from the real Node distribution or a native npm
symlink on PATH, then checks its version by executing the CLI with that Node.
Argument arrays are used; no shell command is built from paths.

Source verification precedes operational config/expected data, platform helper,
child processes, Git and npm. Node built-ins and scripts/integrity.cjs necessarily
load first. Small result records are allowed before validation. Source files are
hashed as raw bytes; runtime never normalizes or regenerates their manifest.
The first successful check records its digest/count. Final verification requires
the same digest, and success prints only after result finalization succeeds.

Publication scope is every regular file below the source root except the root
SHA256SUMS.txt and exactly these pruned root trees: .git, work, results,
node_modules. Other hidden files, helpers and tests remain in scope. Links,
including Windows junctions, are rejected within the publication tree. Narrow
exclusions are output/metadata, not a way to omit source. Do not place code there.
The source manifest is excluded from its own list; its SHA-256 is in results.

Every run creates a new upstream clone, npm cache and adapter build. Empty npm
configs and cleared inherited npm/harness/Node overrides prevent accidental reuse.
Git receives per-command core.autocrlf=false, core.longpaths=true and --no-pager.
No global tool settings change. The pinned package, lock and workflow are checked
before the exact authorized npm install --no-audit --no-fund --legacy-peer-deps.
Only the two documented lock root versions changing 0.14.1 to 0.15.0 are allowed;
all other drift stops the gate, including Linux-specific differences.

The 58 upstream tests, network guard and 35 G1 cases run unchanged. A successful
run is local fixture qualification with real cryptographic signing by ephemeral
unfunded in-memory keys; it is not live-chain acceptance. U0 24 remains historical.
Compare case IDs, outcomes and signer counts, not random identities or timestamps.

Source failure reports SOURCE_INTEGRITY, a category and relative path, nonzero
exit, and NOT_RUN suites. Other failures retain stage and nonzero status.
Raw command logs can contain local paths and belong only in private review.
Finalization failure cannot print success or reset an earlier nonzero status.
VERIFY checks source and optionally result bytes/verdict; it does not rerun tests.

R2 qualification freezes all docs/source and the manifest in a local candidate
commit, verifies staged blob bytes independently, then uses fresh clones with
core.autocrlf=true and false and an archive without .git. Full Windows and Linux
runs must come from the same commit. Changed source invalidates earlier evidence.
WSL is reported independently from generic Linux and is never inferred from a
container run. Failed attempts are retained in the private review evidence.
