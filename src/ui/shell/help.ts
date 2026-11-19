// The instructions modal.

import { el } from '../dom.js';

export function toggleHelp(): void {
  el.helpBd.classList.toggle('on');
}

export function helpBdClick(e: MouseEvent): void {
  if (e.target === el.helpBd) toggleHelp();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') el.helpBd.classList.remove('on');
});
