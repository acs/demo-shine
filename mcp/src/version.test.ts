import { describe, expect, it } from 'vitest';

import { serverVersion, versionMismatchReason } from './version.js';

describe('the version check', () => {
  it('reads the version the server was built with', () => {
    expect(serverVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('lets a page of the same release be driven', () => {
    expect(versionMismatchReason('1.2.3', '1.2.3')).toBeNull();
  });

  it('refuses a page of another release, with a reason that names both', () => {
    const reason = versionMismatchReason('1.2.3', '1.2.4');
    expect(reason).toContain('v1.2.3');
    expect(reason).toContain('v1.2.4');
  });

  it('refuses a page with no surface at all', () => {
    expect(versionMismatchReason('', '1.2.3')).toMatch(/automation surface/);
  });
});
