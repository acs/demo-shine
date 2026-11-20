// The frame renderer the encoder draws through: the annotations, the dissolve at a
// join, and the preview. It lives in the view layer; the encoder imports no view.

import type { Frame, FrameRendererPort } from '../../application/ports/EncoderPort.js';
import { drawAnnotations } from '../annotating/annotation-layer.js';
import { DISSOLVE_S, dissolve } from '../clip/dissolve.js';
import { el } from '../dom.js';

export class FrameRenderer implements FrameRendererPort {
  hold(context: CanvasRenderingContext2D): void {
    dissolve.hold(context.canvas);
  }

  dissolve(context: CanvasRenderingContext2D, since: number): number | null {
    const held = dissolve.canvas();
    const alpha = dissolve.alpha(since);
    if (!held || alpha === null) return null;
    context.save();
    context.globalAlpha = 1;
    context.drawImage(held, 0, 0, context.canvas.width, context.canvas.height);
    context.restore();
    return alpha;
  }

  draw(context: CanvasRenderingContext2D, frame: Frame): void {
    // An annotation dissolves in and out at the edges of its stretch, exactly as the
    // review draws it, so the file holds the same soft arrival and departure.
    drawAnnotations(context, context.canvas.width, context.canvas.height, frame.annotations, null, {
      at: frame.sourceTime, total: frame.recordingLength, seconds: DISSOLVE_S,
    });
  }

  preview(context: CanvasRenderingContext2D): void {
    const preview = el.cv.getContext('2d');
    if (!preview) return;
    preview.drawImage(context.canvas, 0, 0, el.cv.width, el.cv.height);
  }
}

export const frameRenderer = new FrameRenderer();
