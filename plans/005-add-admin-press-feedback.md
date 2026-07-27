# 005 — Add restrained admin press feedback

- **Status**: DONE
- **Commit**: b0d5b48
- **Severity**: LOW
- **Category**: Purpose & frequency; feedback
- **Estimated scope**: 1 file, about 35 lines

## Problem

The shared admin action styles define hover feedback but no press feedback:

```css
/* src/index.css:154-176 — current */
.admin-primary-button,
.admin-secondary-button,
.admin-add-button,
.admin-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  cursor: pointer;
  text-decoration: none;
}

.admin-primary-button:hover { background: #0d6049; }
```

These controls can be used tens of times per day, so only fast, subtle tactile feedback is appropriate.

## Target

This plan depends on plan 001's `--ease-out` and `--duration-press` tokens. Apply the audit playbook's exact press scale and duration:

```css
.admin-primary-button,
.admin-secondary-button,
.admin-add-button,
.admin-icon-button {
  transition:
    transform var(--duration-press) var(--ease-out),
    opacity var(--duration-press) var(--ease-out);
}

.admin-primary-button:not(:disabled):active,
.admin-secondary-button:active,
.admin-add-button:not(:disabled):active,
.admin-icon-button:not(:disabled):active {
  transform: scale(.97);
}

@media (prefers-reduced-motion: reduce) {
  .admin-primary-button,
  .admin-secondary-button,
  .admin-add-button,
  .admin-icon-button {
    transition: opacity var(--duration-press) ease;
  }

  .admin-primary-button:not(:disabled):active,
  .admin-secondary-button:active,
  .admin-add-button:not(:disabled):active,
  .admin-icon-button:not(:disabled):active {
    transform: none;
    opacity: .85;
  }
}
```

## Repo conventions to follow

- All affected control styles already share one selector block in `src/index.css:154-165`; extend that block rather than duplicating base declarations.
- Plan 001 owns motion tokens.
- Existing hover color changes remain unchanged.

## Steps

1. Execute plan 001 first.
2. Add the target transform and opacity transitions to the existing shared admin-button block.
3. Add the active selector immediately after the shared block.
4. Add the reduced-motion override with opacity-only press feedback.
5. Verify disabled buttons never scale or change opacity.

## Boundaries

- Do NOT add press motion to text inputs, checkboxes, sidebar rows, map controls, draggable markers, or the keyboard-driven place selector.
- Do NOT alter hover colors, disabled opacity, dimensions, or click behavior.
- Do NOT gate press feedback behind a hover media query; touch users need press feedback too.
- Do NOT add dependencies or keyframes.
- If plan 001 is absent or the cited styles have drifted since `b0d5b48`, STOP and report.

## Verification

- **Mechanical**: run `npm test` and `npm run build`.
- **Feel check**: press each admin button family with mouse and touch emulation. Confirm:
  - the scale is brief and never delays the action;
  - disabled Save does not move;
  - links styled as secondary buttons still activate normally;
  - repeated presses retarget smoothly because this uses transitions, not keyframes;
  - reduced motion replaces scaling with a brief opacity response.
- **Done when**: every scoped enabled control provides consistent feedback without affecting layout or disabled controls.
