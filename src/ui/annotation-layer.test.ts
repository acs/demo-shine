import { describe, expect, it } from 'vitest';

import { drawAnnotations, registerRenderer, rendererOf } from './annotation-layer.js';
import type { AnnotationRenderer } from './annotation-layer.js';
import type { AnyAnnotation } from '../domain/annotation/Annotation.js';
import { Span } from '../domain/clip/Span.js';

// A 2-D context is not in node, so the layer is proved against a stand-in that
// counts what a renderer asked of it — the same idea as the fakes behind the ports.
function fakeCtx() {
  const calls: string[] = [];
  const noop = (name: string) => () => { calls.push(name); };
  const ctx = {
    save: noop('save'), restore: noop('restore'), beginPath: noop('beginPath'),
    moveTo: noop('moveTo'), lineTo: noop('lineTo'), closePath: noop('closePath'),
    stroke: noop('stroke'), fill: noop('fill'), arc: noop('arc'),
    translate: noop('translate'), rotate: noop('rotate'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const arrow = (id: string): AnyAnnotation => ({
  id, kind: 'arrow', span: Span.of(0, 1),
  geometry: { from: { x: 0.1, y: 0.5 }, to: { x: 0.9, y: 0.5 } },
});

describe('the annotation layer', () => {
  it('knows the arrow, and null for a kind it does not draw', () => {
    expect(rendererOf('arrow')?.id).toBe('arrow');
    expect(rendererOf('hologram')).toBeNull();
  });

  it('draws the arrow it is handed', () => {
    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrow('a')]);
    expect(calls).toContain('stroke');
    expect(calls).toContain('fill');
  });

  it('takes a new renderer without changing what the arrow draws', () => {
    const box: AnnotationRenderer<{ x: number; y: number }> = {
      id: 'box',
      draw: () => {},
      hitTest: () => true,
      handles: () => [],
    };
    registerRenderer(box);
    expect(rendererOf('box')?.id).toBe('box');

    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [arrow('a')]);
    expect(calls).toContain('stroke');
  });

  it('skips a kind it cannot draw, rather than failing', () => {
    const { ctx, calls } = fakeCtx();
    drawAnnotations(ctx, 320, 180, [{ id: 'z', kind: 'hologram', span: Span.of(0, 1), geometry: {} }]);
    expect(calls).toEqual([]);
  });
});
