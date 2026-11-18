// The export use case: what should be written, given the session.
//
// It reads the clip — the takes and what was cut out — and answers with a plan,
// which is a value. Everything after that needs a browser: demuxing, decoding, a
// canvas, an encoder. That half stays in src/offline-export.ts, behind
// `exportOffline(plan)`, and this half runs in node with a fake collection of takes.
//
// Only `ExportPlan` and the clip come in here: the fade length is the app's
// (src/ui/fade.ts) and is handed over, so the domain stays free of the view.

import type { Clip } from '../domain/clip/Clip.js';
import { ExportPlan, type ExportSettings } from '../domain/clip/ExportPlan.js';

// A hair off the end: a WebM's last frame is not decodable right at the end, so
// the export stops a moment short of it.
const END_MARGIN = 0.05;

export function planExport(clip: Clip, settings: ExportSettings): ExportPlan | null {
  const total = clip.total();
  const to = total - END_MARGIN;
  if (!clip.takes.count() || to <= 0) return null;

  const segments = clip.segmentsIn(0, to);
  if (!segments.length) return null;

  return ExportPlan.of(segments, clip.takes.all(), to, clip.timeline(), settings, clip.annotations.all);
}
