// The record use case: one press of Record.
//
// It owns the sequence of a take — sources, mix, record, stop, take added — and
// draws nothing. A refusal is a value, not an exception; the flow reports it.

import type { Clip } from '../domain/clip/Clip.js';
import type { Take } from '../domain/clip/Take.js';
import type { SourceSet } from '../domain/capture/SourceSet.js';
import type { CropRegion } from '../domain/capture/CropRegion.js';
import type { CapturePort } from './ports/CapturePort.js';
import type { WebcamPort } from './ports/WebcamPort.js';
import type { MicrophonePort } from './ports/MicrophonePort.js';
import type { CompositorPort } from './ports/CompositorPort.js';
import type { TakeRecorderPort } from './ports/TakeRecorderPort.js';
import type { TakeProbePort } from './ports/TakeProbePort.js';
import type { ClockPort } from './ports/ClockPort.js';

export type RecordOutcome =
  | { kind: 'started'; stream: MediaStream }
  | { kind: 'stopped'; take: Take }
  | { kind: 'refused'; reason: string };

export interface RecordDeps {
  readonly clip: Clip;
  readonly capture: CapturePort;
  readonly webcam: WebcamPort;
  readonly mic: MicrophonePort;
  readonly compositor: CompositorPort;
  readonly recorder: TakeRecorderPort;
  readonly probe: TakeProbePort;
  readonly clock: ClockPort;
  readonly sources: () => SourceSet;
  readonly region: () => CropRegion;
  readonly drawBubble?: (context: CanvasRenderingContext2D) => void;
  readonly setAudio?: (hasAudio: boolean) => void;
}

export class RecordTake {
  private startedAt = 0;

  constructor(private readonly deps: RecordDeps) {}

  start(): RecordOutcome {
    const sources = this.deps.sources();
    if (!sources.screen && !sources.webcam) {
      return { kind: 'refused', reason: 'A take needs a picture: turn on the screen or the webcam.' };
    }
    const screen = this.deps.capture.current();
    const webcam = this.deps.webcam.current();
    const mic = this.deps.mic.current();
    const composed = this.deps.compositor.open({
      screen: screen?.stream ?? null,
      webcam,
      mic,
      region: this.deps.region(),
      audio: true,
      drawBubble: this.deps.drawBubble,
    });
    this.deps.recorder.start(composed.stream);
    this.startedAt = this.deps.clock.now();
    this.deps.setAudio?.(composed.hasAudio);
    return { kind: 'started', stream: composed.stream };
  }

  async stop(): Promise<RecordOutcome> {
    const blob = await this.deps.recorder.stop();
    this.deps.compositor.close();
    const wall = Math.max(0.1, (this.deps.clock.now() - this.startedAt) / 1000);
    const measured = await this.deps.probe.measure(blob).catch(() => null);
    const duration = measured ?? wall;
    const take = this.deps.clip.addTake(blob, duration);
    return { kind: 'stopped', take };
  }
}
