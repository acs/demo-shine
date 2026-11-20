// The text: the third kind, and the test of the seam.
//
// The section arms this kind, the user types a line, and it is placed centred over the
// picture, in hand so the shared canvas can move and resize it at once. The box's height
// is the font size and its width is what the line measured at that size — both in
// fractions of the picture — so the same text lands the same place and size on the
// preview, on the export canvas and after a reload. A corner drag scales the box, and
// the text grows and shrinks with it; there is no free resize, because text is not a
// picture to stretch.
//
// Everything else — picking it, moving it, copying, deleting, undoing, saving,
// exporting — is the shared canvas's and the clip's. This file writes none of it.
//
// It is its own renderer as well as its plugin: one object, one id, like the arrow and
// the image.

import { TextAnnotation, type TextGeometry } from '../../domain/annotation/TextAnnotation.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { el } from '../dom.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type CreationContext,
} from './annotation-plugin.js';

// How tall the text is by default, as a fraction of the picture's height.
const DEFAULT_HEIGHT = 0.08;
// And the widest it may be placed, so a long line still fits on the picture.
const MAX_WIDTH = 0.9;

const FONT_WEIGHT = '600';
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const FILL = '#ffffff';
const OUTLINE = 'rgba(2,3,8,0.72)';

const ARMED = 'TEXT — type the text to show';
const NO_TEXT = 'TEXT — no text entered';
const NO_FIT = 'TEXT — that text did not fit';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14"/><path d="M12 5v14"/><path d="M9 19h6"/></svg>';

/** The font a size is drawn — and measured — with, so the two cannot disagree. */
function fontFor(pixels: number): string {
  return `${FONT_WEIGHT} ${pixels}px ${FONT_FAMILY}`;
}

/** The text kind in the view: its action, its look, and how a new one is made. */
export class TextPlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = TextAnnotation.id;

  readonly action: AnnotationAction = {
    label: 'Text',
    title: 'Add text over this section',
    icon: ACTION_ICON,
  };

  /** The text is its own renderer, so a kind is one object with one id. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  begin(ctx: CreationContext): void {
    ctx.say(ARMED);
    const typed = window.prompt('Text to show', '');
    if (typed === null) { ctx.cancel(NO_TEXT); return; }
    const text = typed.trim();
    if (!text) { ctx.cancel(NO_TEXT); return; }

    const size = this.measure(text, ctx.picture);
    if (!size) { ctx.cancel(NO_FIT); return; }

    const annotation = TextAnnotation.create(ctx.span, {
      text,
      x: (1 - size.width) / 2,
      y: (1 - size.height) / 2,
      width: size.width,
      height: size.height,
    });
    if (!annotation) { ctx.cancel(NO_FIT); return; }
    ctx.commit(annotation);
  }

  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void {
    if (!(annotation instanceof TextAnnotation)) return;
    const geometry: TextGeometry = annotation.geometry;
    const size = geometry.height * h;
    if (!(size > 0)) return;
    ctx.save();
    ctx.font = fontFor(size);
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.strokeStyle = OUTLINE;               // a dark edge, so it reads over any picture
    ctx.fillStyle = FILL;
    ctx.strokeText(geometry.text, geometry.x * w, geometry.y * h);
    ctx.fillText(geometry.text, geometry.x * w, geometry.y * h);
    ctx.restore();
  }

  /**
   * The box a line needs at the default size, in fractions of the picture: its width
   * comes from measuring the text with the same font the renderer draws with, and its
   * height is the font size. A line too wide to fit is shrunk, keeping the two in step.
   */
  private measure(text: string, picture: { w: number; h: number }): { width: number; height: number } | null {
    if (!(picture.w > 0) || !(picture.h > 0)) return null;
    const context = el.cv.getContext('2d');
    if (!context) return null;

    const previous = context.font;
    context.font = fontFor(DEFAULT_HEIGHT * picture.h);
    const measured = context.measureText(text).width;
    context.font = previous;
    if (!(measured > 0)) return null;

    let width = measured / picture.w;
    let height = DEFAULT_HEIGHT;
    if (width > MAX_WIDTH) {
      const k = MAX_WIDTH / width;
      width = MAX_WIDTH;
      height *= k;
    }
    return { width, height };
  }
}

// One text kind: the section offers its action, and the layer draws it.
export const textPlugin = new TextPlugin();
registerRenderer(textPlugin);
registerPlugin(textPlugin);