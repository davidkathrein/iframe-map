# 001 — Animate the Ortskarte

- **Status**: DONE
- **Commit**: b0d5b48
- **Severity**: MEDIUM
- **Category**: Physicality & origin; accessibility; cohesion
- **Estimated scope**: 2 files, about 70 lines

## Problem

The public map mounts and unmounts its most prominent detail surface instantly:

```tsx
// src/App.tsx:629 — current
{selectedPlace && <PlaceCard place={selectedPlace} onClose={() => setSelectedPlaceId(null)} />}
```

The card is anchored to the bottom edge (`src/App.tsx:637`), so appearing without a spatial bridge feels disconnected from the map selection. Immediate unmounting also prevents an exit transition.

## Target

Add shared motion tokens to `src/index.css`:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-press: 160ms;
  --duration-popover: 180ms;
  --duration-surface: 240ms;
  --duration-drawer: 280ms;
}
```

Create a small presence helper in `src/App.tsx` that retains a value long enough for CSS exit transitions:

```tsx
function usePresenceValue<T>(value: T | null, exitMs: number) {
  const [renderedValue, setRenderedValue] = useState<T | null>(value);
  const [visible, setVisible] = useState(Boolean(value));

  useEffect(() => {
    let frame: number | undefined;
    let timeout: number | undefined;

    if (value !== null) {
      setRenderedValue(value);
      frame = window.requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      timeout = window.setTimeout(() => setRenderedValue(null), exitMs);
    }

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [exitMs, value]);

  return { renderedValue, visible };
}
```

Render the retained place and expose `data-state="open" | "closed"` on the card. Animate only `transform` and `opacity`:

```css
.place-card {
  transform-origin: bottom center;
  transition:
    transform var(--duration-surface) var(--ease-out),
    opacity var(--duration-surface) var(--ease-out);
}

.place-card[data-state="closed"] {
  opacity: 0;
  transform: translateY(16px) scale(.97);
  pointer-events: none;
}

.place-card[data-state="open"] {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .place-card {
    transition: opacity 200ms ease;
  }

  .place-card[data-state="closed"],
  .place-card[data-state="open"] {
    transform: none;
  }
}
```

## Repo conventions to follow

- Global application styles live in `src/index.css`.
- Existing marker motion at `src/index.css:30-44` uses CSS transitions on `transform`; do not add a motion dependency.
- Use the exact strong curves above from the animation audit playbook. Do not use bare `ease` for entrances.
- Keep the existing responsive position, dimensions, shadow, and map-selection behavior unchanged.

## Steps

1. In `src/index.css`, add the seven motion tokens to the existing `:root` block.
2. In `src/App.tsx`, add `usePresenceValue` after the icon helpers and before map components.
3. In `App`, call `usePresenceValue(selectedPlace, 240)` and render `PlaceCard` from `renderedValue`.
4. Add a required `visible: boolean` prop to `PlaceCard`.
5. Add the stable `place-card` class and `data-state={visible ? "open" : "closed"}` to the existing `<aside>`. Preserve all existing Tailwind classes.
6. Add the target CSS, including the reduced-motion branch, to `src/index.css`.
7. Confirm that reopening during the 240ms exit cancels the pending unmount and retargets from the current visual state.

## Boundaries

- Do NOT change map movement, place selection, card content, responsive positioning, or the Google Maps link.
- Do NOT animate dimensions, `bottom`, `left`, or `right`.
- Do NOT add dependencies or keyframes.
- If the cited conditional or `<aside>` has drifted since commit `b0d5b48`, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit successfully.
- **Feel check**: select and close several places on desktop and mobile widths. Confirm:
  - the card rises subtly from its bottom anchor and never scales from zero;
  - selecting another place while open updates content without replaying the entrance;
  - closing and immediately reopening retargets smoothly without flashing;
  - at 10% playback speed, only transform and opacity change;
  - with `prefers-reduced-motion: reduce`, the card only fades and does not move or scale.
- **Done when**: entry and exit both complete, rapid interruption is smooth, and the DOM card is removed after the exit.
