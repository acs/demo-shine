# UI Contract: Camera Picker

**Feature**: `001-select-webcam-picker` | **Type**: browser UI contract

## Element

```html
<select id="cam-pick" aria-label="Camera" title="Camera"></select>
```

Placed in `.srcs` immediately after `#webcam-btn`, inside the `Record sources` group.

## Visibility

| Condition | Picker |
|-----------|--------|
| `webcamOn` is false | hidden |
| `webcamOn` is true and `cameras.length <= 1` | hidden |
| `webcamOn` is true and `cameras.length > 1` | shown |

The element uses the `hidden` attribute; CSS must not override `[hidden]`.

## Options

- One `<option>` per camera, in enumeration order.
- `value` = `deviceId`.
- `text` = the display label (device label, or `Camera N`; duplicates get ` (N)`).
- The selected option is the active camera's `deviceId` when known; otherwise the first option.

## Enabled

| Phase | Picker |
|-------|--------|
| `idle`, `live`, `review`, `encoding` | enabled |
| `starting`, `recording` | disabled |

This matches `locked()` in `ui/source-buttons.ts`.

## Events

| Event | Source | Behaviour |
|-------|--------|-----------|
| `change` | the select | Switch the webcam to `value`; then `syncSources()`. |
| `devicechange` | `navigator.mediaDevices` | Refresh the list; stop and toast if the active camera is gone. |

## Errors

- `getUserMedia` rejection: keep the current stream if there is one; show a toast with the error name. The picker stays on the previous option.
- The active camera disappears: stop the stream, clear the selection, show a toast, hide the picker if fewer than two cameras remain.

## Accessibility

- `aria-label="Camera"` names the control.
- Native keyboard navigation and the mobile OS picker are kept.
- The control is not a toggle: it does not carry `aria-pressed`.

## Out of scope

- Persisting the choice across reloads.
- Switching cameras during a take.
- A picker for the microphone.
- Changing the camera while the webcam is off.
