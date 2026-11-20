# Quickstart: Webcam Picker

**Feature**: `001-select-webcam-picker` | **Date**: 2026-11-20

## Prerequisites

- `npm install`
- A browser with camera support.
- For the multi-camera scenarios: two cameras, or two virtual cameras (for example, OBS Virtual Camera plus the built-in camera), or a phone with front and rear cameras.
- For mobile: `npm run dev:https` and open the LAN address on the phone; the HTTPS certificate must be accepted.

## Run

```bash
npm run dev          # desktop, http://127.0.0.1:5173
npm run dev:https    # mobile, https://<lan-ip>:5173
```

## Automated checks

```bash
npx vitest run src/ui/camera-list.test.ts   # pure helpers
npx vitest run                              # the whole suite
```

The pure helpers cover the display label, duplicate labels, and the should-show predicate. The picker's DOM behaviour is covered by a browser harness during development (`verify-camera-picker.html`, deleted before commit) and by the scenarios below.

## Scenarios

### 1. One camera — no picker

1. Open the app with one camera.
2. Turn the webcam on.
3. **Expected**: the preview starts and no picker is shown.

### 2. Two cameras — picker appears

1. Open the app with two cameras.
2. Turn the webcam on.
3. **Expected**: the picker appears beside the webcam button with both cameras listed; the device's default camera is selected and its preview is shown.

### 3. Switch camera

1. With the picker shown, choose the other camera.
2. **Expected**: the preview updates to the new camera within 2 seconds; the selection stays on the new camera.

### 4. Take in progress

1. Start a take.
2. **Expected**: the picker is disabled while the take is starting or recording; it is enabled again in review.

### 5. Camera unplugged

1. With the webcam on and the picker shown, unplug the active camera (or stop the virtual camera).
2. **Expected**: the webcam stops, a toast explains the camera went away, and the picker hides or shows the remaining camera.

### 6. Permission denied

1. Deny camera permission when the webcam is turned on.
2. **Expected**: a toast reports the failure; no picker appears.

### 7. No camera

1. Open the app with no camera.
2. **Expected**: the webcam button is disabled; no picker appears.

### 8. Mobile front and back

1. Open the app on a phone with two cameras.
2. Turn the webcam on.
3. **Expected**: the picker lists both cameras; switching flips the preview between front and back.

### 9. Empty labels

1. Use a browser or device that reports empty labels.
2. **Expected**: the picker shows `Camera 1`, `Camera 2`, and the options are distinguishable.

### 10. Browser harness

1. Copy `index.html` to `verify-camera-picker.html` and inject a module script before `</body>`.
2. Stub `navigator.mediaDevices.enumerateDevices` to return two fake cameras and `getUserMedia` to return a fake stream whose track reports a `deviceId`.
3. Check: the picker is hidden before the webcam starts; it shows two options after; the default is selected; the change event switches; the phase `recording` disables it.
4. Open it on the dev server and read the `<pre id="verify">` output.
5. Delete the file before committing.

## What is not automated

The real camera switch needs a real device and permission; no harness can grant that. The scenarios above are the evidence for that level.
