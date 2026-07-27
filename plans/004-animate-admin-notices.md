# 004 — Animate admin save notices

- **Status**: DONE
- **Commit**: b0d5b48
- **Severity**: LOW
- **Category**: Feedback; accessibility
- **Estimated scope**: 2 files, about 40 lines

## Problem

Remote save success and failure feedback appears and disappears abruptly:

```tsx
// src/AdminApp.tsx:655-656 — current
<div className="admin-header-actions">
  {notice && <div className={`admin-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "success" ? <Check size={16} /> : <AlertCircle size={16} />}{notice.text}</div>}
```

This feedback is occasional and important, but motion must remain restrained because the admin interface is information-dense.

## Target

This plan depends on plan 001's shared helper and tokens. Retain the notice for 180ms:

```tsx
const noticePresence = usePresenceValue(notice, 180);
```

Because the helper currently lives in `src/App.tsx`, move it without behavioral changes into `src/use-presence-value.ts` and import it from both `src/App.tsx` and `src/AdminApp.tsx`.

```css
.admin-notice {
  transition:
    transform var(--duration-popover) var(--ease-out),
    opacity var(--duration-popover) var(--ease-out);
}

.admin-notice[data-state="closed"] {
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
}

.admin-notice[data-state="open"] {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .admin-notice {
    transition: opacity 200ms ease;
    transform: none;
  }
}
```

## Repo conventions to follow

- Hooks and plain logic use TypeScript without a UI dependency; place the shared hook directly under `src/`.
- Existing notice color and layout styles are at `src/index.css:142-152` and `src/index.css:218-219`. Extend them; do not replace them.
- Preserve `role="alert"` for errors and `role="status"` for success.

## Steps

1. Execute plan 001 first.
2. Move `usePresenceValue` verbatim from `src/App.tsx` to `src/use-presence-value.ts`, export it, and import it in both applications.
3. In `Editor`, create `noticePresence` from `notice` with a 180ms exit.
4. Render the notice from `noticePresence.renderedValue` and use that retained value for its kind, role, icon, and text.
5. Add `data-state={noticePresence.visible ? "open" : "closed"}` and `aria-hidden={!noticePresence.visible}`.
6. Extend `.admin-notice` with the target motion CSS and add the state rules and reduced-motion override.

## Boundaries

- Do NOT animate login errors, coordinate validation, image-upload feedback, spinners, or editable form content.
- Do NOT auto-dismiss notices or change when `setNotice(null)` runs.
- Do NOT change header layout or animate dimensions.
- Do NOT add dependencies or keyframes.
- If plan 001 is absent or the cited code has drifted since `b0d5b48`, STOP and report.

## Verification

- **Mechanical**: run `npm test` and `npm run build`.
- **Feel check**: trigger save success, save error, and clearing a notice by editing. Confirm:
  - the message moves only 4px and remains readable immediately;
  - rapid clear/reappearance retargets smoothly;
  - screen-reader roles still match success and error;
  - at 10% playback no header dimensions animate;
  - reduced motion uses opacity only.
- **Done when**: save notices enter and exit reliably, preserve accessibility semantics, and unmount after 180ms.
