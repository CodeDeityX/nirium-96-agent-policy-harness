# R2 source delivery repair and claim limits

Required predecessor: 2ebcfc3a985bf8d66badfbbfda8886393ac9f636.
Required Nirium: 96f43ac79df9a19c7783faaefc91b454459139ad.
The published test/g1.test.cjs Git blob is 414a113a53814ccaabe41cdc3f7f62d0d0ee07e1,
17,537 bytes, SHA-256 068edf698857099aa123ace5dff94e8ada445d7a197c8d20e4904de7a7489fd1.
The stale manifest declares 00761d669c882d67a5b1409edf24eaf4e0fbb50f3863d6d459eac27708e2e0be.
The predecessor has verify(root), but reads config first, labels its hash failure
ENVIRONMENT and later writes a literal true. Its observed mismatch exits 1.
The earlier 17,538-byte ZIP comparison is historical; no original ZIP is required
or newly compared here. Protected publication files remain byte-identical to Git.

Changed files: .gitattributes establishes explicit LF text publication;
SHA256SUMS.txt is prepared once for the complete candidate; integrity.cjs enforces
strict syntax, safe paths, duplicates, raw hashes and exact scope coverage;
run.cjs verifies before config/operations, derives status and rechecks the digest;
verify.cjs reports structured checks; platform.cjs resolves native npm safely;
config/upstream.json changes only supported platform launch metadata; README and
reproducibility docs explain launch/trust limits; test/integrity.test.cjs adds
separate integrity controls. RUN.ps1 and VERIFY.ps1 retain ASCII-compatible bytes.

An unsigned manifest checks consistency. It does not authenticate the publisher,
protect against replacement of verifier plus manifest, or establish code safety.
The bootstrap must be trusted; no attestation service or hook integration is added.
Checks are snapshots, not an OS sandbox or protection against a malicious process
continuously rewriting files between reads. Reparse links are rejected, not followed.

Integrity controls invoke the actual runner from disposable copies with spaces.
A recreates the exact published stale test hash with unchanged published test bytes;
B mutates one byte. Missing/empty/malformed/duplicate/omitted entries, unexpected
files, unsafe paths, directory links and stale malformed config are also rejected.
An external test preload records attempted child-process and common Node network
calls before blocking them. Zero observed calls proves ordering at those intercepted
APIs, not absence of every possible native I/O channel. No production bypass exists.
G changes the manifest at the first intercepted operational call after the initial
gate; final recheck fails and no success is printed. H verifies intact bytes and
observes the gate reaching the first child, which is blocked by the test monitor.
The finalization control injects a result write failure and requires nonzero exit.
These controls do not stand in for complete upstream/G1 regressions.

All original simulation disclosures and boundaries apply. L01 pending-capacity
reservation and L02 signer bypass remain NOT_SOLVED; G2/G4 NOT_RUN; G3 NOT_SOLVED.
No funded keys, broadcasts, remote writes, publication or maintainer reproduction
is claimed. Review packaging and local-only candidate Git commits are separate
from the public runner. The full private review ZIP must not be published.
