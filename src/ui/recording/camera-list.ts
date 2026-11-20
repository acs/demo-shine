// The camera list's display rules. Pure: no DOM, no browser API — so they can be
// tested in node. The webcam module turns these into the picker's options.

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraOption {
  value: string;
  label: string;
}

/** A camera's display label: its own label, or a numbered fallback. */
export function cameraLabel(device: CameraDevice, index: number): string {
  const label = device.label.trim();
  return label || `Camera ${index + 1}`;
}

/** The picker's options. Duplicate labels get a suffix so they stay distinct. */
export function cameraOptions(cameras: CameraDevice[]): CameraOption[] {
  const seen = new Map<string, number>();
  return cameras.map((camera, index) => {
    const base = cameraLabel(camera, index);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      value: camera.deviceId,
      label: count === 0 ? base : `${base} (${count + 1})`,
    };
  });
}

/** The picker is worth showing only when there is a choice to make. */
export function shouldShowPicker(cameraCount: number, webcamOn: boolean): boolean {
  return webcamOn && cameraCount > 1;
}
