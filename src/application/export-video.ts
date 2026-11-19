// The export use case: decide what to write, encode it, hand it over.
//
// The plan is the domain's; the encoder only encodes it; the download only saves
// the bytes. A refusal is a value, not an exception.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportTarget } from '../domain/export/ExportTarget.js';
import type { EncoderPort, ExportStats, FrameRendererPort } from './ports/EncoderPort.js';
import type { DownloadPort } from './ports/DownloadPort.js';
import type { ClockPort } from './ports/ClockPort.js';
import { planExport } from './export-clip.js';

export type ExportOutcome =
  | { kind: 'exported'; blob: Blob; stats: ExportStats }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

export interface ExportDeps {
  readonly clip: Clip;
  readonly encoder: EncoderPort;
  readonly renderer: FrameRendererPort;
  readonly download: DownloadPort;
  readonly clock: ClockPort;
  readonly audio: () => boolean;
  readonly fadeSeconds: number;
}

export class ExportVideo {
  constructor(private readonly deps: ExportDeps) {}

  async run(target: ExportTarget, onProgress?: (source: number) => void): Promise<ExportOutcome> {
    if (!this.deps.encoder.available()) {
      return { kind: 'refused', reason: 'This browser cannot write video — it needs Chrome 94+ or Firefox 130+.' };
    }
    const plan = planExport(this.deps.clip, { audio: this.deps.audio(), fadeSeconds: this.deps.fadeSeconds });
    if (!plan) return { kind: 'refused', reason: 'There is nothing to export.' };
    try {
      const encoded = await this.deps.encoder.encode(plan, this.deps.renderer, { target, onProgress });
      this.deps.download.save(encoded.blob, `democlip-${this.deps.clock.now()}.${target}`);
      return { kind: 'exported', blob: encoded.blob, stats: encoded.stats };
    } catch (error) {
      return { kind: 'failed', reason: error instanceof Error ? error.message : 'the export failed' };
    }
  }
}
