// The camera menu: which camera the webcam uses.
//
// A small popover under the camera button, styled and placed like the Export
// menu. It is a body-level element so the control row cannot clip it, and it
// places itself each time it opens (above the button when there is no room
// below). The items are rebuilt from the current camera list, so a camera that
// comes or goes is reflected the next time the menu opens.
//
// It owns its open state and its listeners; the webcam module owns the list and
// the selection, and is handed the device the person picked.

import { el } from '../dom.js';
import type { CameraOption } from './camera-list.js';

type Choose = (deviceId: string) => void;

const GAP = 6;      // between the button and the menu
const EDGE = 8;     // the least the menu may sit from a viewport edge

class CameraMenu {
  private choose: Choose = () => {};
  private items: CameraOption[] = [];
  private selected: string | null = null;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (!el.camMenu.contains(target) && !el.camPickBtn.contains(target)) this.close();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private readonly onResize = (): void => this.close();

  init(choose: Choose): void {
    this.choose = choose;
  }

  /** Replace the options and the selected device; redraws only when open. */
  setItems(items: CameraOption[], selected: string | null): void {
    this.items = items;
    this.selected = selected;
    if (this.isOpen) this.render();
  }

  get isOpen(): boolean {
    return el.camMenu.classList.contains('on');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.items.length === 0) return;
    this.render();
    const button = el.camPickBtn.getBoundingClientRect();
    const width = el.camMenu.offsetWidth;
    const height = el.camMenu.offsetHeight;
    const roomBelow = window.innerHeight - button.bottom - GAP;
    const top = roomBelow >= height + EDGE ? button.bottom + GAP : button.top - height - GAP;
    const left = Math.max(EDGE, Math.min(button.left, window.innerWidth - width - EDGE));
    el.camMenu.style.left = `${Math.round(left)}px`;
    el.camMenu.style.top = `${Math.round(Math.max(EDGE, top))}px`;
    el.camMenu.classList.add('on');
    el.camPickBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
  }

  close(): void {
    if (!this.isOpen) return;
    el.camMenu.classList.remove('on');
    el.camPickBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }

  private render(): void {
    el.camMenu.replaceChildren(...this.items.map(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cam-item';
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute('aria-checked', String(item.value === this.selected));
      const name = document.createElement('span');
      name.className = 'cam-item-name';
      name.textContent = item.label;
      const check = document.createElement('span');
      check.className = 'cam-item-check';
      check.textContent = item.value === this.selected ? '✓' : '';
      button.append(name, check);
      button.addEventListener('click', () => this.pick(item.value));
      return button;
    }));
  }

  private pick(deviceId: string): void {
    this.close();
    this.choose(deviceId);
  }
}

export const cameraMenu = new CameraMenu();
