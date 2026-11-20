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

**Decision**: Open the chosen camera first, then stop the old stream and replace `el.wcv.srcObject`; the caller then calls `syncSources()`.

**Rationale**: A failed switch leaves the current preview running, so the user never loses the picture for a camera that cannot be opened. `syncSources()` already decides what the preview shows after a source change.

**Alternatives considered**:
- Stop the old stream first — rejected: a failed switch would leave a dead preview.
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

### 10. Accessibility

**Decision**: Use a native `<select>` with `aria-label="Camera"` and a visible text label in the controls; keep the native keyboard and mobile OS picker.

**Rationale**: Native semantics give keyboard, screen-reader and mobile behaviour for free. The app's `ExportMenu` is a custom menu, but a select is the right control for a short list of named choices.

**Alternatives considered**:
- Custom popup menu — rejected: more code, more accessibility risk, no benefit for a flat list.

## Open questions

None. All NEEDS CLARIFICATION items are resolved by the spec's clarifications and the decisions above.
