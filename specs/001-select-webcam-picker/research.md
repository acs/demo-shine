# Research: Webcam Picker

**Feature**: `001-select-webcam-picker` | **Date**: 2026-11-20

## Decisions

### 1. Enumerating cameras and reading labels

**Decision**: Use `navigator.mediaDevices.enumerateDevices()`, filter `kind === 'videoinput'`, and read the list after `getUserMedia` succeeds (permission granted).

**Rationale**: `enumerateDevices()` is the standard API and needs no dependency. Browsers hide labels until the user grants camera permission, so the list is read after the first successful `getUserMedia`; the app already calls `enumerateDevices()` in `detectWebcam()` for presence, so this extends the same call.

**Alternatives considered**:
- Probe each camera with `getUserMedia` to read its label — rejected: opens every camera, slow and permission-heavy.
- Read labels before permission — rejected: labels are empty strings, so the picker would show placeholders.

### 2. Finding the default camera

**Decision**: Start with `getUserMedia({ video: true })`, then read `stream.getVideoTracks()[0].getSettings().deviceId` and mark that device as selected.

**Rationale**: The browser's default is whatever `video: true` resolves to; the track's settings name the device. This matches the user's choice of "system default" and needs no guessing.

**Alternatives considered**:
- Guess the default from labels — rejected: labels are not standardized and do not say "default".
- Use `facingMode: 'user'` — rejected: the user chose the system default, and `facingMode` is mobile-only.

### 3. Starting a specific camera

**Decision**: `getUserMedia({ video: { deviceId: { exact: deviceId } } })`.

**Rationale**: `exact` selects the named device and fails with `OverconstrainedError` if it is gone, which the picker can catch and report.

**Alternatives considered**:
- `deviceId: deviceId` (ideal) — rejected: the browser may silently fall back to another camera, so the user's choice would not be honoured.

### 4. Switching cameras

**Decision**: Stop the old stream first, then open the chosen camera and replace `el.wcv.srcObject`; if the new camera cannot be read, reopen the previous one so the preview is not left dead. The caller then calls `syncSources()`.

**Rationale**: A phone's camera hardware can only be open once, so opening the chosen camera while the old one is still held fails with `NotReadableError`. Stopping first is what the hardware requires; reopening the previous camera keeps the "never lose the picture" promise when the new one cannot be read.

**Alternatives considered**:
- Open the chosen camera first — rejected: on a phone this fails with `NotReadableError` because the old camera is still held.
- Keep both streams and swap tracks — rejected: more state to own for no benefit.

### 5. Labels and duplicates

**Decision**: Use the device's `label` when non-empty; otherwise `Camera N` (1-based). If two labels collide, append ` (N)` to the later one.

**Rationale**: Every option must be distinguishable. The spec's FR-003 asks for a human-readable label and its Assumptions allow a numbered fallback.

**Alternatives considered**:
- Append the deviceId — rejected: long and unreadable.
- Show the groupId — rejected: meaningless to the user.

### 6. Device changes

**Decision**: Listen to `devicechange`; refresh the list; if the active device is gone, stop the stream and show a toast.

**Rationale**: The spec's edge case (FR-008) asks for a stop and an explanation. The app already listens to `devicechange` in `initWebcam()`; this extends it.

**Alternatives considered**:
- Fall back to another camera automatically — rejected: switching the camera without the user asking is surprising, and mid-take it would splice feeds.

### 7. Picker visibility

**Decision**: Show the picker when the webcam is on and there is more than one camera; hide it otherwise.

**Rationale**: The spec's flow is "turn on the webcam → picker appears" and its Assumption says the picker appears after permission. Hiding it while the webcam is off keeps the controls quiet and avoids empty labels before permission.

**Alternatives considered**:
- Always show it when >1 camera — rejected: clutters the controls and shows unlabelled devices before permission.
- Show it only after the user opens a menu — rejected: an extra click for a one-step choice.

### 8. Locking during a take

**Decision**: Disable the picker when the phase is `starting` or `recording`, matching `locked()` in `ui/source-buttons.ts`.

**Rationale**: FR-009 and the existing pattern: a take owns the sources. The webcam button is already disabled then; the picker must follow.

**Alternatives considered**:
- Leave it enabled and ignore the change — rejected: a dead control is worse than a disabled one.

### 9. Persistence

**Decision**: Keep the selection in memory for the page; do not persist it.

**Rationale**: The spec's Assumptions say the choice is remembered for the session but not across reloads. The app's only persisted preference is the theme.

**Alternatives considered**:
- `localStorage` — rejected: the spec explicitly excludes persistence.
- IndexedDB — rejected: overkill for one string.

### 10. Accessibility and the control's shape

**Decision**: Use a small caret button beside the webcam toggle that opens a custom popover menu, styled and placed like the app's `ExportMenu`. The caret carries `aria-haspopup="menu"` and `aria-expanded`; the menu is `role="menu"` with `role="menuitemradio"` items and `aria-checked`.

**Rationale**: An inline `<select>` was the first design, but in the control row it crowded the record button and the microphone on a phone. A popover keeps the row compact and reads as part of the same control family as Export. The menu is short and flat, so the custom role structure is simple to get right.

**Alternatives considered**:
- Native `<select>` — rejected: it widened the source row enough to sit behind the record button's rings on a phone, and the user asked for it to look like the Export picker.
- A plain list without roles — rejected: loses the menu semantics and the checked state.

## Open questions

None. All NEEDS CLARIFICATION items are resolved by the spec's clarifications and the decisions above.
