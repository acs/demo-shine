# UI Contract: Camera Picker

**Feature**: `001-select-webcam-picker` | **Type**: browser UI contract

## Elements

```html
<button id="cam-pick-btn" type="button" aria-haspopup="menu" aria-expanded="false"
        aria-label="Camera" title="Camera" hidden>
  <svg><!-- chevron --></svg>
</button>

<div id="cam-menu" role="menu" aria-label="Camera"></div>
```

The caret sits in `.srcs` immediately after `#webcam-btn`, inside the `Record
sources` group. The menu is a body-level element, like the Export menu, so the
control row cannot clip it; `src/ui/recording/camera-menu.ts` places it each time
it opens.

## Visibility

| Condition | Caret |
|-----------|-------|
| `webcamOn` is false | hidden |
| `webcamOn` is true and `cameras.length <= 1` | hidden |
| `webcamOn` is true and `cameras.length > 1` | shown |

The caret uses the `hidden` attribute; CSS must not override `[hidden]`. When the
caret hides, the menu closes.

## Options

The menu is rebuilt from the camera list each time it opens:

- One `role="menuitemradio"` button per camera, in enumeration order.
- The button's text is the display label (device label, or `Camera N`; duplicates
  get ` (N)`).
- `aria-checked="true"` marks the active camera's `deviceId`; the others are false.
- A check mark is drawn on the selected item.

## Placement

The menu is `position: fixed`, opens upward when there is no room below the caret
(`roomBelow >= height + edge`), and stays inside the viewport. It closes on a click
outside, Escape, a choice, or a window resize.

## Enabled

| Phase | Caret |
|-------|-------|
| `idle`, `live`, `review`, `encoding` | enabled |
| `starting`, `recording` | disabled |

This matches `locked()` in `ui/recording/source-buttons.ts`.

## Events

| Event | Source | Behaviour |
|-------|--------|-----------|
| `click` | the caret | Toggle the menu. |
| `click` | a menu item | Switch the webcam to that `deviceId`; close; then `syncSources()`. |
| `devicechange` | `navigator.mediaDevices` | Refresh the list; stop and toast if the active camera is gone. |

## Errors

- `getUserMedia` rejection on a switch: the adapter stops the old stream first and
  reopens the previous camera if the new one cannot be read, so the preview stays
  alive; a toast carries the error name. The selection stays on the previous
  camera.
- The active camera disappears: stop the stream, clear the selection, show a toast,
  hide the caret if fewer than two cameras remain.

## Accessibility

- `aria-label="Camera"` names the caret; `aria-haspopup="menu"` and
  `aria-expanded` describe the popover.
- The menu is `role="menu"`; items are `role="menuitemradio"` with `aria-checked`.
- The caret is not a toggle: it does not carry `aria-pressed`.

## Out of scope

- Persisting the choice across reloads.
- Switching cameras during a take.
- A picker for the microphone.
- Changing the camera while the webcam is off.
