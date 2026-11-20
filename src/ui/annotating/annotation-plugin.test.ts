import { describe, expect, it } from 'vitest';

import { pluginOf, plugins, registerPlugin, type AnnotationPlugin } from './annotation-plugin.js';
// Imported for its side effect: the arrow registers itself, which is what makes the
// section offer its action and the layer draw it.
import './arrow-plugin.js';

// A throwaway plugin, the one the register exists for. It lives only in this test:
// registering it is what proves a new kind needs no change to the canvas or the marks.

const stub = (id: string): AnnotationPlugin => ({
  id,
  action: { label: id, title: `add a ${id}`, icon: '<svg/>' },
  renderer: { id, draw: () => {} },
  begin: () => {},
});

describe('the annotation plugin register', () => {
  it('knows the arrow, and null for a kind it does not offer', () => {
    expect(pluginOf('arrow')?.id).toBe('arrow');
    expect(pluginOf('hologram')).toBeNull();
  });

  it('takes a new plugin and lists it, without the arrow changing', () => {
    const before = pluginOf('arrow')?.action.label;
    registerPlugin(stub('box'));
    expect(pluginOf('box')?.id).toBe('box');
    expect(plugins().map(p => p.id)).toContain('box');
    expect(pluginOf('arrow')?.action.label).toBe(before);
  });

  it('replaces a plugin registered under the same id, as a test wants', () => {
    registerPlugin(stub('box'));
    registerPlugin({ ...stub('box'), action: { label: 'Box', title: 't', icon: 'i' } });
    expect(pluginOf('box')?.action.label).toBe('Box');
  });
});
