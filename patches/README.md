# Account SDK review candidate

This pnpm patch is built from frontend-platform commit `b910e7a` (persistent
navigation presentation). It keeps this PR installable with `--frozen-lockfile`
and lets required CI validate the consumer before the SDK is merged/published.
It contains the compiled navigation store and auth runtime, their declarations,
and an additive entry-point export; the published base version stays pinned.

After approval, merge/release the SDK through its existing workflow, replace this
patch with that published exact version, and rerun all consumer CI before merge.
No registry publication, local tarball, or unmerged production deployment is
required to review this candidate.
