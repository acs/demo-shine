import { describe, expect, it } from 'vitest';

import {
  pluginOf, plugins, propertiesOf, registerPlugin,
  type AnnotationPlugin, type AnnotationProperty,
} from './annotation-plugin.js';
// Imported for its side effect: the arrow registers itself, which is what makes the
// section offer its action and the layer draw it. Only this plugin is imported — the
// image's and the text's modules touch the DOM at load, so their lists are proved in
// the browser harness instead (quickstart §2).
import './arrow-plugin.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import { Span } from '../../domain/clip/Span.js';

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

describe('the properties a kind offers', () => {
  it('the arrow offers its colour', () => {
    expect(pluginOf('arrow')?.properties?.map(p => p.id)).toEqual(['colour']);
  });

  it('a kind that offers none has no list, so it gets no settings control', () => {
    registerPlugin(stub('plain'));
    expect(pluginOf('plain')?.properties ?? []).toEqual([]);
  });

  it('propertiesOf answers for the annotation it is given, and for none', () => {
    const arrow = Arrow.create(Span.of(0, 1), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 });
    expect(propertiesOf(arrow).map(p => p.id)).toEqual(['colour']);
    expect(propertiesOf(null)).toEqual([]);
  });

  it('a new kind brings its own properties with no change to the register', () => {
    const colour: AnnotationProperty = {
      id: 'colour',
      label: 'Colour',
      control: 'colour',
      value: () => '#111827',
      with: annotation => annotation,
    };
    registerPlugin({ ...stub('tag'), properties: [colour] });
    expect(pluginOf('tag')?.properties?.map(p => p.id)).toEqual(['colour']);
  });
});