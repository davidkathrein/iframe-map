# Animation implementation plans

Plans are stamped against commit `b0d5b48`. They are implementation specifications produced by the read-only `improve-animations` workflow.

| # | Plan | Severity | Status | Dependencies |
| --- | --- | --- | --- | --- |
| 001 | [Animate the Ortskarte](001-animate-place-card.md) | MEDIUM | DONE | None |
| 002 | [Animate filter surfaces from their anchors](002-animate-filter-surfaces.md) | MEDIUM | DONE | 001 |
| 003 | [Animate the visit-information popover](003-animate-info-popover.md) | LOW | DONE | 001 |
| 004 | [Animate admin save notices](004-animate-admin-notices.md) | LOW | DONE | 001 |
| 005 | [Add restrained admin press feedback](005-add-admin-press-feedback.md) | LOW | DONE | 001 |

## Recommended execution order

1. Execute 001 first. It establishes the shared presence helper and motion tokens.
2. Execute 002 next because the responsive filter surfaces are the second-highest-leverage public interaction.
3. Execute 003 to complete the public-map surface motion.
4. Execute 004, which moves the presence helper into a shared module for the admin application.
5. Execute 005 last; it is independent of presence handling but consumes the tokens from 001.

Run each with `improve-animations execute plans/NNN-short-slug.md`. After all plans are implemented, run the full public-map and admin feel checks together to catch competing or overlapping motion.
