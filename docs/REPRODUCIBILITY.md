# R3 reproduction contract

Target 1dc596932b0b124ad39bb54c4cb00b10c3b08e5e,
tree c5552a44c8d386f689eb764617cf89081fbb7b21.
Node 22.18.0 / npm 10.9.3; Windows PowerShell 5.1 or native Linux Node under WSL.
Exact commands are in README. Each run uses a new detached upstream clone, empty
npm configs and fresh cache. The pinned upstream CI installation mode is
`npm install --no-audit --no-fund --legacy-peer-deps`.
The lock MUST remain byte-identical: `allowedLockChanges = []`, changed tracked
files `[]`, empty install-only.diff and worktree.diff. No hand-edited lock.

Order: build -> tsc --noEmit -> full upstream tests -> G1 -> supplementary.
Expected 56 Jest + 114 Node = 170 total, 35/35 adapted, 34/35 strict R2
correspondence. G1-SELF-ESCALATION is the single strict non-equivalence:
CONTEXT_MISMATCH, zero policy consultation and zero signer calls. Fifty
supplementary diagnostics have their own ledger and are not G1 count additions.

Source verification precedes config parsing and operational child processes;
final verification requires the initial manifest digest. Scope is all regular
source files except SHA256SUMS.txt itself and root .git/work/results/node_modules.
Links, unsafe paths, duplicates, omissions and extra source files are rejected.
LF publication bytes are enforced by .gitattributes. Runtime never repairs source.
Publication audit is offline/read-only and checks current facts, documentation,
historical exclusions and private material. Negative tests intentionally use
stale or unsafe manifests in generated fixtures.

Qualification requires Windows and WSL on the same final bytes, then fresh local
clones of the exact commit, then fresh public remote clones. Compare case IDs,
outcomes and counts, not random keys, timestamps or paths. A source change requires
new manifest generation and complete requalification. Results stay generated and
untracked. Verify checks hashes and runner verdict, not a fresh test execution.
Runner PASS means current executable assertions passed, never strict 35/35
semantic equivalence. Failures retain nonzero exits and stage evidence.
