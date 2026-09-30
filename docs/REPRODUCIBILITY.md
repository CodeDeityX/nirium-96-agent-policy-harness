# Reproduction contract

Use the prerequisites and one command in README. Git and the official Node
distribution must be on PATH. The runner uses the npm CLI shipped adjacent to
node.exe, validates versions, and supplies empty per-run npm user/global configs.
It clears inherited NODE_OPTIONS/NODE_PATH and harness result paths for child
processes. Proxy/network restrictions can block preparation; they are not worked
around by vendoring modules or changing dependencies.

Git commands explicitly set `core.longpaths=true` for that command only. No
global Git setting or short original workspace path is required. A first clean
reproduction exposed Git's Windows path-length limit (checkout returned 0 but
reported a missing file); that failure is retained in the review evidence. The
tracked-file hash inventory detected it before installation. The public runner
now supplies the required long-path mode explicitly.

Every run creates a new clone, npm cache and adapter build under `work/<timestamp>`.
It does not use any previous ZIP, previous clone, global compiler or global npm
cache. The pinned commit, package/lock/workflow SHA-256 values and resolved package
versions are checked. The upstream workflow must contain the exact authorized
install line. The only allowed install lock drift is two root version fields
from 0.14.1 to 0.15.0. All other dependency changes stop the run.

The candidate SHA256SUMS covers its source/config/docs and excludes generated
work/results. Each results folder has a separate manifest. `VERIFY.ps1` can
check both. A result folder is newly generated even for a failed run; stdout,
stderr and exit-code JSON are retained. The runner never deletes past results.

A successful single invocation says RUN_VERDICT=PASS. The separate review
acceptance verdict additionally requires a second clean-folder invocation of
the documented command; one run alone is not called independent reproduction.
Ephemeral keys and random request prefixes vary across runs, so evidence bytes
differ while IDs, outcomes, signer counts and assertions must match expectations.

On upstream build/test failure: BLOCKED_UPSTREAM_BASELINE. On dependency access
failure: NIRIUM_96_PUBLIC_HARNESS_BLOCKED_DEPENDENCY_ACCESS. On G1 failure:
NIRIUM_96_PUBLIC_HARNESS_BLOCKED_G1. Other stages report their own explicit blocker.
The runner does not continue into G1 after a failed baseline and never turns a
failed comparison into PASS.

No source is patched inside Nirium. The runner records tracked-file hashes,
install-only diff, production-source diff and final status. A worktree containing
the automatic lock change is not called literally unchanged. The package is a
public candidate prepared for review, without publication or endorsement.
