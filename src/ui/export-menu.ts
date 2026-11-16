// The Export menu: where a clip goes.
//
// A small menu under the Export button — a File, or Bluesky. It is a body-level
// element rather than a child of the header, because the header clips what
// overflows it (`.ctrl` is `overflow:hidden`), so a menu inside it would be cut
// off; it places itself under the button each time it opens, and gives up and
// closes if the window changes size underneath it.
//
// It owns its own open state and the listeners that end it — a click outside, an
// Escape, a choice — so the button only asks it to toggle, and the flow is handed
// the target the person picked, knowing nothing about the menu.

import { el } from './dom.js';
import type { ExportTarget } from '../infra/export-target.js';

type Choose = (target: ExportTarget) => void;

const GAP = 6;      // between the button and the menu
const EDGE = 8;     // the least the menu may sit from the window's edge

class ExportMenu {
  private choose: Choose = () => {};

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Node;
    // The button toggles, so a click on it is not "outside" — the toggle handler
    // would fight this one and close what it just opened.
    if (!el.expMenu.contains(target) && target !== el.btnExp) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private readonly onResize = (): void => this.close();

  init(choose: Choose): void {
    this.choose = choose;
    el.expFile.addEventListener('click', () => this.pick('webm'));
    el.expBluesky.addEventListener('click', () => this.pick('mp4'));
  }

  get isOpen(): boolean {
    return el.expMenu.classList.contains('on');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    // The menu keeps its layout while hidden, so it can be measured and placed
    // without a flicker. The Export button sits in the control bar along the
    // bottom of the window, so there is usually no room below it: the menu opens
    // upward unless it genuinely fits underneath, and stays inside the window
    // either way.
    const button = el.btnExp.getBoundingClientRect();
    const width = el.expMenu.offsetWidth;
    const height = el.expMenu.offsetHeight;
    const roomBelow = window.innerHeight - button.bottom - GAP;
    const top = roomBelow >= height ? button.bottom + GAP : button.top - height - GAP;
    const left = Math.max(EDGE, Math.min(button.right - width, window.innerWidth - width - EDGE));
    el.expMenu.style.left = `${Math.round(left)}px`;
    el.expMenu.style.top = `${Math.round(Math.max(EDGE, top))}px`;
    el.expMenu.classList.add('on');
    el.btnExp.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    el.expMenu.classList.remove('on');
    el.btnExp.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  private pick(target: ExportTarget): void {
    this.close();
    this.choose(target);
  }
}

export const exportMenu = new ExportMenu();
