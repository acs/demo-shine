// The timeline lane: where the annotations are in time.
//
// An arrow is invisible outside its stretch, so the timeline has to show where it is —
// otherwise a person who forgot where they put one has to scrub the whole clip to find
// it. A mark per annotation, at the start of its stretch, laid out in timeline (kept)
// time exactly as the marks are, so a cut closes up over it too.
//
// A mark is a finder and nothing else: **clicking** it picks that arrow on the picture
// and brings the playhead to its start. It is not dragged. When an arrow is shown over
// is decided when it is made — from the selected stretch — and repeated at another
// moment with copy and paste, so there is nothing here to drag, and a press that moves
// a little can no longer move an arrow by accident.
//
// It is a view of the clip and nothing else: the clip saying what changed is the whole
// of the coupling, and the picture's selection is followed through `onSelectionChange`.

import { currentPhase } from '../../state.js';
import { session } from '../../session.js';
import { el } from '../dom.js';
import { keptLengthNow, keptOf } from '../clip/clip.js';
import { playback } from '../clip/playback.js';
import { canvas, onSelectionChange } from './annotation-canvas.js';
import { pluginOf } from './annotation-plugin.js';

const DEFAULT_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg>';

export function initAnnotationLane(): void {
  el.tlAnnots.addEventListener('click', onClick);

  // The clip says what changed; the lane follows — on every event, `take-added`
  // included: a longer clip moves every mark, because a mark is a fraction of it.
  session.clip.onChange(() => renderLane());
  onSelectionChange(renderLane);
  renderLane();
}

function onClick(e: MouseEvent): void {
  const mark = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-annot');
  if (!mark) return;
  // The lane sits inside the timeline, whose own click drops a mark on the clip. A
  // click here is a click on an arrow, and must not also start a selection.
  e.stopPropagation();
  pick(mark.dataset.id ?? '');
}

// Picking a mark picks the arrow on the picture and brings the playhead to it.
function pick(id: string): void {
  const annotation = session.clip.annotations.byId(id);
  if (!annotation) return;
  canvas.pick(id);
  playback.hold(annotation.span.s * session.clip.total());
}

/** Draw a mark per annotation, at the start of its stretch, with the picked one marked. */
export function renderLane(): void {
  const host = el.tlAnnots;
  if (currentPhase() !== 'review' || !(session.clip.total() > 0)) {
    host.replaceChildren();
    return;
  }
  const total = session.clip.total();
  const kept = Math.max(0.001, keptLengthNow());
  const width = Math.max(1, host.getBoundingClientRect().width);
  const selected = canvas.selectedId;

  // A mark sits at the **start** of its stretch, as the kind's symbol rather than the
  // whole stretch: several arrows over one section share a start, and bars for them
  // would lie on top of each other. Marks that would still collide step aside by one
  // mark's width, so every arrow stays reachable — the title gives its true moment.
  const STEP_PX = 13;
  let lastX = -Infinity;
  let nudge = 0;
  let html = '';
  for (const annotation of session.clip.annotations.all) {
    const s = keptOf(annotation.span.s * total), e = keptOf(annotation.span.e * total);
    if (e - s < 0.001) continue;                 // entirely cut away: nothing to show
    const x = (s / kept) * width;
    nudge = x - lastX < STEP_PX ? nudge + STEP_PX : 0;
    lastX = x;
    const on = annotation.id === selected;
    // The kind's own symbol and name, from its plugin, so a new kind is found on the
    // lane without editing this module.
    const plugin = pluginOf(annotation.kind);
    const icon = plugin?.action.icon ?? DEFAULT_ICON;
    const label = plugin?.action.label ?? 'Annotation';
    html += `<div class="tl-annot${on ? ' on' : ''}" data-id="${annotation.id}"`
          + ` style="left:${((x / width) * 100).toFixed(3)}%;margin-left:${nudge}px"`
          + ` title="${label} at ${s.toFixed(2)}s — click to go to it">${icon}`
          + `</div>`;
  }
  host.innerHTML = html;
}
