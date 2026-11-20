// The properties inspector: the one surface that shows and edits what can be changed
// about the picked annotation, whatever its kind.
//
// It names no kind. It asks `propertiesOf(annotation)` for the picked annotation's list
// and renders one control per descriptor — a palette of swatches for a colour, the words
// row for a text — and applies a change through `clip.changeAnnotation`, so announcing,
// the one undo and keeping it are the clip's and not this module's.
//
// It is a body-level popover placed beside the annotation and opened from the settings
// control on it, the way `ui/recording/camera-menu.ts` places the camera menu. It owns
// its open state and its listeners; nothing else calls into it but the canvas, which
// toggles it.

import { session } from '../../session.js';
import { el, toast } from '../dom.js';
import { COLOURS } from '../../domain/annotation/AnnotationColour.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { propertiesOf, type AnnotationProperty } from './annotation-plugin.js';

const GAP = 8;      // between the annotation's box and the panel
const EDGE = 8;     // the least the panel may sit from a viewport edge

class PropertiesInspector {
  private id: string | null = null;

  get isOpen(): boolean {
    return el.propMenu.classList.contains('on');
  }

  /** Watch the clip: a change to the picked annotation re-renders, a removal closes. */
  init(): void {
    session.clip.onChange(event => {
      if (!this.id) return;
      if (event.type === 'cleared') { this.close(); return; }
      if (event.type === 'annotation-removed' && event.annotation.id === this.id) { this.close(); return; }
      if (event.type === 'annotation-changed' && event.annotation.id === this.id) {
        this.render();
        this.place();
      }
    });
  }

  /** The settings control: open for this annotation when closed, close when open. */
  toggle(annotation: Annotation): void {
    if (this.isOpen && this.id === annotation.id) this.close();
    else this.open(annotation);
  }

  open(annotation: Annotation): void {
    if (propertiesOf(annotation).length === 0) return;   // nothing to open for this kind
    this.id = annotation.id;
    this.render();
    this.place();
    el.propMenu.classList.add('on');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    if (!this.isOpen) return;
    el.propMenu.classList.remove('on');
    this.id = null;
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    // The event's own path, not `contains`: applying a change re-renders the panel, so a
    // swatch's click can reach here after the button it started on is gone.
    const path = event.composedPath();
    // A press on the picture is the canvas's business — it picks, moves, or opens with
    // the settings control, and closes this itself when the pick changes.
    if (path.includes(el.propMenu) || path.includes(el.cv)) return;
    this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.isOpen) return;
    // Close the panel and leave the annotation picked; the canvas would otherwise read
    // the same Escape as "let go of it".
    event.stopPropagation();
    this.close();
  };

  private readonly onResize = (): void => this.close();

  /** Put the panel beside the annotation's box, clamped to the viewport. */
  private place(): void {
    const annotation = this.id ? session.clip.annotations.byId(this.id) : null;
    if (!annotation) return;
    const handles = annotation.handles();
    if (handles.length === 0) return;

    const rect = el.cv.getBoundingClientRect();
    const xs = handles.map(handle => handle.x);
    const ys = handles.map(handle => handle.y);
    const left = rect.left + Math.min(...xs) * rect.width;
    const right = rect.left + Math.max(...xs) * rect.width;
    const top = rect.top + Math.min(...ys) * rect.height;

    const width = el.propMenu.offsetWidth;
    const height = el.propMenu.offsetHeight;
    const roomRight = window.innerWidth - right - GAP;
    const x = roomRight >= width + EDGE ? right + GAP : Math.max(EDGE, left - width - GAP);
    const y = Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    el.propMenu.style.left = `${Math.round(x)}px`;
    el.propMenu.style.top = `${Math.round(y)}px`;
  }

  private render(): void {
    const annotation = this.id ? session.clip.annotations.byId(this.id) : null;
    if (!annotation) { this.close(); return; }
    el.propMenu.replaceChildren(...propertiesOf(annotation).map(property => this.row(property, annotation)));
  }

  private row(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-row';
    const name = document.createElement('span');
    name.className = 'prop-name';
    name.textContent = property.label;
    host.append(name, property.control === 'colour'
      ? this.swatches(property, annotation)
      : this.words(property, annotation));
    return host;
  }

  private swatches(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-swatches';
    const current = property.value(annotation);
    for (const colour of COLOURS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prop-swatch';
      button.style.background = colour;
      button.title = colour;
      button.setAttribute('aria-label', colour);
      button.setAttribute('aria-pressed', String(colour === current));
      button.addEventListener('click', () => this.apply(property, annotation, colour));
      host.append(button);
    }
    return host;
  }

  /** A `text` property: a row to be filled in with the words control. */
  private words(property: AnnotationProperty, annotation: Annotation): HTMLElement {
    const host = document.createElement('div');
    host.className = 'prop-words';
    host.textContent = property.value(annotation);
    return host;
  }

  /** Apply a change through the clip: it announces, the one undo holds it, and this
   *  panel re-renders from the event rather than from here. */
  private apply(property: AnnotationProperty, annotation: Annotation, value: string): void {
    const next = property.with(annotation, value);
    if (!next) { toast(`That ${property.label.toLowerCase()} cannot be used`); return; }
    session.clip.changeAnnotation(annotation.id, next);
  }
}

export const inspector = new PropertiesInspector();