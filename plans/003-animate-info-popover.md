# 003 — Animate the visit-information popover

- **Status**: DONE
- **Commit**: b0d5b48
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 2 files, about 30 lines

## Problem

The visit-information surface teleports beneath its nearby trigger:

```tsx
// src/App.tsx:621-626 — current
{infoOpen && (
  <aside className="absolute left-2 top-[4.9rem] z-20 ...">
    ...
  </aside>
)}
```

It is an occasional, trigger-anchored popover, so a short origin-aware transition improves spatial consistency without slowing repeated map use.

## Target

This plan depends on plan 001. Retain the surface for 180ms:

```tsx
const infoPresence = usePresenceValue(infoOpen ? true : null, 180);
```

Add `info-popover` and `data-state` to the existing aside:

```css
.info-popover {
  transform-origin: top left;
  transition:
    transform var(--duration-popover) var(--ease-out),
    opacity var(--duration-popover) var(--ease-out);
}

.info-popover[data-state="closed"] {
  opacity: 0;
  transform: scale(.97);
  pointer-events: none;
}

.info-popover[data-state="open"] {
  opacity: 1;
  transform: scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .info-popover {
    transition: opacity 200ms ease;
    transform: none;
  }
}
```

## Repo conventions to follow

- Plan 001 owns the shared presence helper and motion tokens.
- `src/App.tsx` already uses state-controlled conditional surfaces; retain that ownership.
- Animate only transform and opacity.

## Steps

1. Execute plan 001 first.
2. Create `infoPresence` beside `infoOpen`.
3. Render the aside while `infoPresence.renderedValue` is non-null.
4. Add `info-popover`, `data-state={infoPresence.visible ? "open" : "closed"}`, and `aria-hidden={!infoPresence.visible}`.
5. Add the target CSS to `src/index.css`.

## Boundaries

- Do NOT alter the information copy, close button, position, size, shadow, or map interaction.
- Do NOT animate the info trigger or add hover motion.
- Do NOT add dependencies or keyframes.
- If plan 001 is absent or the cited code has drifted since `b0d5b48`, STOP and report.

## Verification

- **Mechanical**: run `npm test` and `npm run build`.
- **Feel check**: open, close, and rapidly toggle the popover. Confirm:
  - it scales from the top-left near its trigger, never from `scale(0)`;
  - exit reverses entry;
  - the retained closed surface cannot capture clicks;
  - at 10% playback only opacity and transform change;
  - reduced motion fades without scaling.
- **Done when**: entry and exit are interruptible and the aside unmounts after 180ms.
