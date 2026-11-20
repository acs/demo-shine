# Feature Specification: Webcam Picker

**Feature Branch**: `001-select-webcam-picker`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "add picker to select the webcam if there are several available (mobile phone has 2)"

## Clarifications

### Session 2026-11-20

- Q: When the webcam turns on and more than one camera is available, which camera should be active before the user picks one? → A: The device's system default camera is active; the user switches from the picker.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a camera when multiple are available (Priority: P1)

When a user turns on the webcam and the device has more than one camera (for example, a phone with front and rear cameras), the user needs to be able to choose which camera to use for the recording.

**Why this priority**: Without this, users on multi-camera devices are stuck with the system default, which may be the wrong one (for example, the rear camera when they want to record themselves).

**Independent Test**: Connect a device with two cameras (or use a virtual camera setup), turn on the webcam, and verify that a picker appears and switching cameras updates the preview.

**Acceptance Scenarios**:

1. **Given** the device has two cameras and the user has granted camera permission, **When** the user turns on the webcam, **Then** a picker listing both cameras is shown and the device's default camera is active.
2. **Given** the picker is shown, **When** the user selects the second camera, **Then** the webcam preview switches to that camera's feed.

---

### User Story 2 - No picker for a single camera (Priority: P2)

A user with only one camera should not be burdened with an unnecessary selection step.

**Why this priority**: Keeps the interface simple for the majority of desktop users.

**Independent Test**: Use a device with one camera and verify no picker appears.

**Acceptance Scenarios**:

1. **Given** the device has exactly one camera, **When** the user turns on the webcam, **Then** the webcam starts automatically without showing a picker.

---

### User Story 3 - Change camera during a session (Priority: P3)

A user who has already selected a camera may want to switch to another one without ending the session.

**Why this priority**: Adds flexibility but is not required for the core flow.

**Independent Test**: With the webcam already on, change the selection in the picker and verify the preview updates.

**Acceptance Scenarios**:

1. **Given** the webcam is on and a camera is selected, **When** the user selects a different camera from the picker, **Then** the preview updates to the new camera.

---

### Edge Cases

- What happens when no cameras are available? The webcam toggle is disabled.
- What happens when camera permission is denied? The webcam cannot be turned on; an error message is shown.
- What happens when a camera is disconnected while in use? The stream stops and the user is informed; the webcam toggle is released so the user can re-enable the webcam or choose another camera.
- What happens when the user tries to switch cameras while recording a take? Switching is disabled during an active take; the user must stop the take first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect all available video input devices.
- **FR-002**: When more than one video input device is available, the system MUST present a camera picker in the webcam controls.
- **FR-003**: The picker MUST display a human-readable label for each camera (for example, "Front Camera", "Back Camera").
- **FR-004**: Selecting a camera from the picker MUST update the webcam preview to use the selected camera's stream.
- **FR-005**: The system MUST NOT show the picker when zero or one camera is available.
- **FR-006**: The system MUST handle camera permission denial gracefully, showing an error and not attempting to show a picker.
- **FR-007**: The system MUST remember the user's camera selection for the duration of the session.
- **FR-008**: The system MUST handle a camera becoming unavailable (for example, unplugged) by stopping the stream and informing the user.
- **FR-009**: The system MUST disable camera switching while a take is actively recording.
- **FR-010**: When the picker first appears, the device's system default camera MUST be active until the user selects another.

### Key Entities

- **Camera**: Represents a video input device, identified by a device ID and a label.
- **Camera Selection**: The currently chosen camera for the webcam feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with multiple cameras can select their desired camera in under 5 seconds from turning on the webcam.
- **SC-002**: Switching cameras updates the preview within 2 seconds.
- **SC-003**: 100% of users with a single camera are not shown an unnecessary picker.
- **SC-004**: Users can complete a recording session without encountering a camera selection error in 99% of attempts.

## Assumptions

- The application already requests camera permission when the webcam is turned on; the picker appears after permission is granted.
- The camera picker is a dropdown or small menu within the existing webcam controls area.
- Camera choice is remembered for the session but not persisted across page reloads.
- The default camera is the device's system default; the picker lets the user change it.
- Cameras are labelled by the device's own label; when a device reports no label, a numbered fallback (for example, "Camera 1", "Camera 2") is shown.
- Switching cameras during an active take is not supported; the user must stop the current take first.
