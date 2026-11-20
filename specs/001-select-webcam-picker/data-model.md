# Data Model: Webcam Picker

**Feature**: `001-select-webcam-picker` | **Date**: 2026-11-20

The picker is a view concern: its entities are browser media devices, not domain objects. Nothing here is stored or persisted.

## Entities

### Camera

A video input device as the browser reports it.

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | string | Identity. Stable for the page; may change across sessions. |
| `label` | string | Human-readable name; may be empty before permission. |
| `groupId` | string | Physical device group; not shown. |
| `kind` | `'videoinput'` | Only video inputs are cameras. |

**Validation**: `kind` must be `'videoinput'`; `label` may be empty, in which case the display label falls back to `Camera N`.

### Camera list

The ordered set of cameras from `enumerateDevices()`, filtered to `videoinput`.

**Rules**:
- Order follows the browser's enumeration.
- The list is refreshed on `devicechange` and after the webcam starts.
- The list is the source of truth for the picker's options.

### Camera selection

The `deviceId` of the camera the webcam is using, or the one the user last chose.

| Field | Type | Notes |
|-------|------|-------|
| `deviceId` | string \| null | Null until the webcam starts. Set from the active track's `getSettings().deviceId`. |

**Rules**:
- The selection is set when the webcam starts (the default camera's deviceId).
- Choosing a camera sets the selection and switches the stream.
- The selection is in memory only; it is not persisted.
- If the selected device disappears, the stream stops and the selection is cleared.

### Picker view state

| Field | Type | Notes |
|-------|------|-------|
| `visible` | boolean | `webcamOn && cameras.length > 1` |
| `enabled` | boolean | `phase !== 'starting' && phase !== 'recording'` |
| `options` | `{ value: string; text: string }[]` | One per camera; `value` is the deviceId. |

## State transitions

```text
idle
  └─ webcam on (default camera) ──▶ live, picker visible if >1 camera
live
  ├─ select another camera ──▶ switching ──▶ live (new camera)
  ├─ take starts ──▶ picker disabled
  ├─ device removed (active) ──▶ stopped + toast
  └─ webcam off ──▶ idle, picker hidden
```

## Relationships

- One **camera list** has zero or more **cameras**.
- One **camera selection** points at one **camera** in the list, or is null.
- The picker's options are derived from the camera list; the selected option is the camera selection.

## Notes

- No storage: no IndexedDB, no `localStorage`.
- The camera selection is not part of the clip or the session; it belongs to the webcam source, which is the user's own toggle.
- The `Camera` and `Camera Selection` names match the spec's Key Entities.
