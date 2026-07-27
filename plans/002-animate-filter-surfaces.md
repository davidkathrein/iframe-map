# 002 — Animate filter surfaces from their anchors

- **Status**: DONE
- **Commit**: b0d5b48
- **Severity**: MEDIUM
- **Category**: Physicality & origin; missed opportunities
- **Estimated scope**: 2 files, about 65 lines

## Problem

Both responsive filter surfaces are conditionally mounted with no transition:

```tsx
// src/App.tsx:592-605 — current
{filterPanelOpen && (
  <>
    <div className="absolute right-2 top-[4.75rem] ... lg:block ...">
      ...
    </div>

    <div ref={mobileFilterDialogRef} className="fixed inset-0 z-30 lg:hidden" role="dialog" ...>
      <div className="absolute inset-0 bg-slate-950/25" ... />
      <section className="absolute inset-x-0 bottom-0 ...">
```

The desktop panel should originate at the top-right trigger. The mobile sheet should enter and leave through the bottom edge. Immediate unmounting prevents symmetric exits.

## Target

This plan depends on plan 001, including `usePresenceValue`, `--ease-out`, `--ease-drawer`, `--duration-surface`, and `--duration-drawer`.

Retain the filter subtree for 280ms:

```tsx
const filterPresence = usePresenceValue(filterPanelOpen ? true : null, 280);
```

Render while `filterPresence.renderedValue` is non-null. Apply `data-state={filterPresence.visible ? "open" : "closed"}` to the desktop panel, mobile backdrop, and mobile sheet.

```css
.filter-popover {
  transform-origin: top right;
  transition:
    transform var(--duration-surface) var(--ease-out),
    opacity var(--duration-surface) var(--ease-out);
}

.filter-popover[data-state="closed"] {
  opacity: 0;
  transform: scale(.97);
  pointer-events: none;
}

.filter-popover[data-state="open"] {
  opacity: 1;
  transform: scale(1);
}

.filter-backdrop {
  transition: opacity var(--duration-drawer) var(--ease-out);
}

.filter-sheet {
  transition: transform var(--duration-drawer) var(--ease-drawer);
}

.filter-backdrop[data-state="closed"] {
  opacity: 0;
  pointer-events: none;
}

.filter-backdrop[data-state="open"] { opacity: 1; }
.filter-sheet[data-state="closed"] { transform: translateY(100%); }
.filter-sheet[data-state="open"] { transform: translateY(0); }

@media (prefers-reduced-motion: reduce) {
  .filter-popover,
  .filter-backdrop,
  .filter-sheet {
    transition: opacity 200ms ease;
    transform: none;
  }

  .filter-popover[data-state="closed"],
  .filter-backdrop[data-state="closed"],
  .filter-sheet[data-state="closed"] {
    opacity: 0;
  }

  .filter-popover[data-state="open"],
  .filter-backdrop[data-state="open"],
  .filter-sheet[data-state="open"] {
    opacity: 1;
  }
}
```

## Repo conventions to follow

- `src/App.tsx:495-527` owns focus trapping, Escape handling, and focus restoration. Motion must not change that behavior.
- Plan 001 establishes the presence helper and global motion tokens. Reuse them; do not duplicate helpers or curves.
- The mobile surface is a dialog. Preserve `role="dialog"`, `aria-modal`, its backdrop click handler, and close-button focus.

## Steps

1. Execute plan 001 first.
2. In `App`, create `filterPresence` beside the existing filter state.
3. Replace `{filterPanelOpen && (` with a condition based on `filterPresence.renderedValue`.
4. Add `filter-popover`, `filter-backdrop`, and `filter-sheet` classes to the three existing elements without removing Tailwind classes.
5. Add the same `data-state` value to all three.
6. Add the target CSS to `src/index.css`.
7. Set `aria-hidden={!filterPresence.visible}` on the retained dialog wrapper and ensure closed retained surfaces cannot receive pointer interaction.
8. Keep focus restoration driven by the real `filterPanelOpen` state, not delayed presence.

## Boundaries

- Do NOT animate filter chips, search results, map markers, or the map viewport.
- Do NOT change focus trapping, keyboard controls, breakpoints, filtering logic, or panel layout.
- Do NOT add keyframes or dependencies.
- If plan 001 is not implemented or the cited subtree has drifted since `b0d5b48`, STOP and report.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit successfully.
- **Feel check**: at desktop and below the `lg` breakpoint, open/close by trigger, close button, backdrop, Apply, Escape, and place selection. Confirm:
  - desktop scales from the top-right trigger;
  - mobile backdrop fades while the sheet follows its own height via `translateY(100%)`;
  - rapid toggle retargets instead of restarting;
  - no closed surface accepts clicks;
  - at 10% playback only transform and opacity change;
  - reduced motion uses opacity only.
- **Done when**: all close paths animate symmetrically without delaying focus restoration or breaking the focus trap.
