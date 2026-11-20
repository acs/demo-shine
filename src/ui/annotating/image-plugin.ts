// The image: the second kind, and the proof that a kind is described rather than fitted.
//
// The section arms this kind, and the user then chooses a picture one of three ways —
// a file picker, pasting from the clipboard, or dropping a file on the picture — all of
// them live only while the image is being added. The picture is measured, downscaled
// once if it is far bigger than the recording (so the clip and the frame cost stay
// bounded), kept in `infra/images.ts`, and placed centred keeping its own proportions,
// in hand so the shared canvas can move and resize it at once.
//
// Everything else — picking it, moving it, resizing by a corner, copying, deleting,
// undoing — is the shared canvas's, and this class writes none of it. The listeners for
// paste and drop are this kind's own interactivity, and the canvas never learns about a
// file.
//
// It is its own renderer as well as its plugin: one object, one id, like the arrow.

import { ImageAnnotation, type ImageGeometry } from '../../domain/annotation/ImageAnnotation.js';
import { newAnnotationId, type Annotation } from '../../domain/annotation/Annotation.js';
import { images } from '../../infra/images.js';
import { el } from '../dom.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import {
  registerPlugin,
  type AnnotationAction, type AnnotationPlugin, type CreationContext,
} from './annotation-plugin.js';

// A picture is kept at most twice the clip's picture, so a zoom-in later is not soft
// and a huge one cannot freeze the app or bloat the clip. Re-encoding the *picture* is
// not re-encoding the recording (spec FR-017).
const MAX_SCALE = 2;
// How wide the picture is placed, as a fraction of the recording's width.
const PLACED_WIDTH = 0.4;

const ARMED = 'IMAGE — choose a picture, paste one, or drop one here';
const NO_PICTURE = 'IMAGE — no picture chosen';
const UNREADABLE = 'That picture could not be read';
const NO_FIT = 'IMAGE — that picture did not fit';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-4 4 3 3-3 4 4"/></svg>';

/** A picture, as it is measured and as it is then kept. */
interface PreparedPicture {
  readonly blob: Blob;
  /** The picture's own pixel width ÷ height. */
  readonly imageAspect: number;
}

/** The image kind in the view: its action, its look, and how a new one is made. */
export class ImagePlugin implements AnnotationPlugin, AnnotationRenderer<Annotation> {
  readonly id = ImageAnnotation.id;

  readonly action: AnnotationAction = {
    label: 'Image',
    title: 'Add an image over this section',
    icon: ACTION_ICON,
  };

  /** The image is its own renderer, so a kind is one object with one id. */
  get renderer(): AnnotationRenderer<Annotation> {
    return this;
  }

  begin(ctx: CreationContext): void {
    ctx.say(ARMED);
    void this.make(ctx).catch(error => ctx.abandon(`IMAGE — ${error instanceof Error ? error.message : 'that picture could not be added'}`));
  }

  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void {
    if (!(annotation instanceof ImageAnnotation)) return;
    const source = images.get(annotation.geometry.imageId);
    if (!source) return;                       // not decoded yet — nothing to draw, not a crash
    const { x, y, width, height } = annotation.geometry;
    ctx.drawImage(source, x * w, y * h, width * w, height * h);
  }

  private async make(ctx: CreationContext): Promise<void> {
    const file = await this.choosePicture();
    if (!file) { ctx.abandon(NO_PICTURE); return; }

    const prepared = await this.prepare(file, ctx.picture);
    if (!prepared) { ctx.abandon(UNREADABLE); return; }

    const imageId = newAnnotationId();
    try {
      await images.put(imageId, prepared.blob);
    } catch {
      ctx.abandon(UNREADABLE);
      return;
    }

    const geometry = this.place(ctx, imageId, prepared.imageAspect);
    const annotation = ImageAnnotation.create(ctx.span, geometry);
    if (!annotation) { ctx.abandon(NO_FIT); return; }
    ctx.commit(annotation);
  }

  /** The three ways to choose a picture, whichever comes first. Null when none did. */
  private choosePicture(): Promise<Blob | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);

      const done = (blob: Blob | null): void => {
        window.removeEventListener('paste', onPaste);
        window.removeEventListener('keydown', onKey);
        el.cv.removeEventListener('dragover', onOver);
        el.cv.removeEventListener('drop', onDrop);
        input.remove();
        resolve(blob);
      };
      const firstImage = (list: FileList | null | undefined): File | null => {
        if (!list) return null;
        for (const file of Array.from(list)) if (file.type.startsWith('image/')) return file;
        return null;
      };
      const fromItems = (items: DataTransferItemList | undefined): File | null => {
        if (!items) return null;
        for (const item of Array.from(items)) {
          if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
        }
        return null;
      };
      const onPaste = (e: ClipboardEvent): void => {
        const file = firstImage(e.clipboardData?.files) ?? fromItems(e.clipboardData?.items);
        if (file) { e.preventDefault(); done(file); }
      };
      const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') done(null); };
      const onOver = (e: DragEvent): void => { if (e.dataTransfer) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
      const onDrop = (e: DragEvent): void => {
        const file = firstImage(e.dataTransfer?.files) ?? fromItems(e.dataTransfer?.items);
        if (!file) return;
        e.preventDefault();
        done(file);
      };

      input.addEventListener('change', () => done(firstImage(input.files)), { once: true });
      window.addEventListener('paste', onPaste);
      window.addEventListener('keydown', onKey);
      el.cv.addEventListener('dragover', onOver);
      el.cv.addEventListener('drop', onDrop);
      input.click();
    });
  }

  /** Decode a picture, measure it, and downscale it once if it is far too big. */
  private async prepare(blob: Blob, picture: { w: number; h: number }): Promise<PreparedPicture | null> {
    const image = await this.decode(blob);
    if (!image) return null;
    const iw = image.naturalWidth, ih = image.naturalHeight;
    if (!(iw > 0) || !(ih > 0)) return null;

    const maxW = Math.max(1, picture.w) * MAX_SCALE;
    const maxH = Math.max(1, picture.h) * MAX_SCALE;
    if (iw <= maxW && ih <= maxH) return { blob, imageAspect: iw / ih };

    const scale = Math.min(maxW / iw, maxH / ih);
    const cw = Math.max(1, Math.round(iw * scale));
    const ch = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const context = canvas.getContext('2d');
    if (!context) return { blob, imageAspect: iw / ih };
    context.drawImage(image, 0, 0, cw, ch);
    const smaller = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    return smaller ? { blob: smaller, imageAspect: cw / ch } : { blob, imageAspect: iw / ih };
  }

  private decode(blob: Blob): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      image.src = url;
    });
  }

  /** Centred, at a default width, keeping the picture's own proportions. */
  private place(ctx: CreationContext, imageId: string, imageAspect: number): ImageGeometry {
    const pictureAspect = (ctx.picture.w || 1) / (ctx.picture.h || 1);
    let width = PLACED_WIDTH;
    let height = (width * pictureAspect) / imageAspect;
    if (height > 1) { height = 1; width = (height * imageAspect) / pictureAspect; }
    return {
      imageId,
      x: (1 - width) / 2,
      y: (1 - height) / 2,
      width,
      height,
      imageAspect,
      pictureAspect,
    };
  }
}

// One image kind: the section offers its action, and the layer draws it.
export const imagePlugin = new ImagePlugin();
registerRenderer(imagePlugin);
registerPlugin(imagePlugin);