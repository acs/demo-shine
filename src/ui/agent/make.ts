// Making an annotation of a kind, from data alone.
//
// The kinds whose shape *is* data can be made by an agent: an arrow's two points, a
// text's words. A kind whose shape needs something from outside the clip cannot — an
// image annotation's picture is a file the person chooses, exactly as the share is —
// and it says so rather than making something wrong.
//
// A text is measured with the kind's own measurement, so an agent's text lands at the
// same size and place as a person's would.

import { Arrow } from '../../domain/annotation/Arrow.js';
import { TextAnnotation } from '../../domain/annotation/TextAnnotation.js';
import type { Span } from '../../domain/clip/Span.js';
import { el } from '../dom.js';
import { measureText, measureTextWidth } from '../annotating/text-plugin.js';
import type { Made, MakeAnnotation } from './edit.js';
import type { AnnotationParams } from './surface.js';

const MAX_HEIGHT = 0.4;   // a text may not be so tall it swallows the picture

export const makeAnnotation: MakeAnnotation = (kind, params, span) => {
  if (kind === Arrow.id) return makeArrow(params, span);
  if (kind === TextAnnotation.id) return makeText(params, span);
  return {
    reason: `the app cannot make a ${kind} from data alone — an image's picture is the person's to choose`,
  };
};

function makeArrow(params: AnnotationParams, span: Span): Made {
  const from = pointIn(params, 'from');
  const to = pointIn(params, 'to');
  if (!from || !to) {
    return { reason: 'an arrow needs a "from" and a "to", each { x, y } as a fraction of the picture' };
  }
  const arrow = Arrow.create(span, from, to);
  if (!arrow) return { reason: 'an arrow needs two different points inside the picture' };
  return { annotation: arrow };
}

function makeText(params: AnnotationParams, span: Span): Made {
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text) return { reason: 'a text needs words' };

  const picture = { w: el.cv.width, h: el.cv.height };
  const wanted = typeof params.height === 'number' && params.height > 0
    ? Math.min(params.height, MAX_HEIGHT)
    : null;

  // The same measurement the kind uses when a person makes one, so the two agree.
  const box = wanted === null
    ? measureText(text, picture)
    : { width: measureTextWidth(text, wanted, picture), height: wanted };
  if (!box || !(box.width > 0)) return { reason: 'that text could not be measured on this picture' };

  const x = fractionIn(params, 'x') ?? (1 - box.width) / 2;
  const y = fractionIn(params, 'y') ?? (1 - box.height) / 2;
  const annotation = TextAnnotation.create(span, { text, x, y, width: box.width, height: box.height });
  if (!annotation) return { reason: 'a text needs a box inside the picture' };
  return { annotation };
}

/** A `{ x, y }` argument, as fractions of the picture, or null when it is not one. */
function pointIn(params: AnnotationParams, key: string): { x: number; y: number } | null {
  const value = params[key];
  if (!value || typeof value !== 'object') return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** A fraction argument, clamped inside the picture, or null when it is not a number. */
function fractionIn(params: AnnotationParams, key: string): number | null {
  const value = params[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}
