import { describe, expect, it } from 'vitest';

import { cameraLabel, cameraOptions, shouldShowPicker } from './camera-list.js';

describe('cameraLabel', () => {
  it('uses the device label when it is there', () => {
    expect(cameraLabel({ deviceId: 'a', label: 'FaceTime HD' }, 0)).toBe('FaceTime HD');
  });

  it('falls back to a numbered label when the label is empty', () => {
    expect(cameraLabel({ deviceId: 'a', label: '   ' }, 0)).toBe('Camera 1');
    expect(cameraLabel({ deviceId: 'b', label: '' }, 1)).toBe('Camera 2');
  });
});

describe('cameraOptions', () => {
  it('maps each device to its id and label', () => {
    expect(cameraOptions([
      { deviceId: 'front', label: 'Front Camera' },
      { deviceId: 'back', label: 'Back Camera' },
    ])).toEqual([
      { value: 'front', label: 'Front Camera' },
      { value: 'back', label: 'Back Camera' },
    ]);
  });

  it('numbers duplicate labels so the options stay distinct', () => {
    expect(cameraOptions([
      { deviceId: 'a', label: 'USB Camera' },
      { deviceId: 'b', label: 'USB Camera' },
      { deviceId: 'c', label: 'USB Camera' },
    ])).toEqual([
      { value: 'a', label: 'USB Camera' },
      { value: 'b', label: 'USB Camera (2)' },
      { value: 'c', label: 'USB Camera (3)' },
    ]);
  });

  it('keeps empty labels distinct by position', () => {
    expect(cameraOptions([
      { deviceId: 'a', label: '' },
      { deviceId: 'b', label: '' },
    ])).toEqual([
      { value: 'a', label: 'Camera 1' },
      { value: 'b', label: 'Camera 2' },
    ]);
  });
});

describe('shouldShowPicker', () => {
  it('shows only when the webcam is on and there is more than one camera', () => {
    expect(shouldShowPicker(2, true)).toBe(true);
    expect(shouldShowPicker(2, false)).toBe(false);
    expect(shouldShowPicker(1, true)).toBe(false);
    expect(shouldShowPicker(0, true)).toBe(false);
  });
});
