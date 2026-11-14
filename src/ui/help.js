// The instructions modal.

import { el } from './dom.js';

export function toggleHelp() {
  el.helpBd.classList.toggle('on');
}

export function helpBdClick(e) {
  if (e.target === el.helpBd) toggleHelp();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') el.helpBd.classList.remove('on');
});
