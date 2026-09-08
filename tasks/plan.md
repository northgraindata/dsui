# Shared engineering guidelines

Apply the researched contributor standards to humans and agents through one
canonical set of repository documents. The approved scope is coding guidance;
runtime redesigns need their own contract decisions and implementation changes.

## Sequence

1. Document coding, testing, review, and architecture rules with examples and
   explicit enforcement. Separate current behavior from required direction.
2. Link contributor and agent entry points, add the PR template, and expose the
   formatter check through the same script locally and in CI.
3. Verify commands and local documentation links, review the diff, and record
   remaining enforcement work without claiming it has shipped.

Track acceptance and verification in [todo.md](todo.md). Existing user-added
skills and the skill lockfile are outside this change.

## Decisions and risks

- Human-readable standards are canonical; agent skills cannot silently introduce
  a second product policy or toolchain.
- Architecture documentation must identify the current gap between SDK page
  composition and the host/browser protocol.
- Do not freeze today's SDK surface as the ideal design or change it in a
  documentation rollout.
- CI configuration does not prove GitHub merge protection is enabled.
