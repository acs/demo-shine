// The browser's capture capabilities: screen, webcam and microphone.
//
// One adapter owns the tracks and releases them. The screen is the CapturePort;
// the webcam and the microphone are their own ports over the same adapter.

import type { CapturePort, CaptureSession } from '../application/ports/CapturePort.js';
import type { WebcamPort } from '../application/ports/WebcamPort.js';
import type { MicrophonePort } from '../application/ports/MicrophonePort.js';
import { SourceSet } from '../domain/capture/SourceSet.js';
import { CropRegion } from '../domain/capture/CropRegion.js';

export type ScreenCapture = CaptureSession;

export class CaptureAdapter implements CapturePort {
  private screenCapture: CaptureSession | null = null;
  private webcamStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private endedListeners = new Set<() => void>();

  sources = SourceSet.NONE;
  region = CropRegion.FULL;
  width = 0;
  height = 0;

  setRegion(region: CropRegion): void {
    this.region = region;
  }

  async start(): Promise<CaptureSession> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const hasAudio = stream.getAudioTracks().length > 0;
    this.screenCapture = { stream, hasAudio };
    this.sources = this.sources.withScreen(true);
    const video = stream.getVideoTracks()[0];
    if (video) {
      const settings = video.getSettings();
      this.width = settings.width ?? this.width;
      this.height = settings.height ?? this.height;
      video.addEventListener('ended', () => this.endScreen(), { once: true });
    }
    return this.screenCapture;
  }

  current(): CaptureSession | null {
    return this.screenCapture;
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  stop(): void {
    this.screenCapture?.stream.getTracks().forEach(track => track.stop());
    this.screenCapture = null;
    this.sources = this.sources.withScreen(false);
  }

  async startWebcam(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    this.webcamStream = stream;
    this.sources = this.sources.withWebcam(true);
    const settings = stream.getVideoTracks()[0]?.getSettings();
    this.width = settings?.width ?? this.width;
    this.height = settings?.height ?? this.height;
    return stream;
  }

  currentWebcam(): MediaStream | null {
    return this.webcamStream;
  }

  stopWebcam(): void {
    this.webcamStream?.getTracks().forEach(track => track.stop());
    this.webcamStream = null;
    this.sources = this.sources.withWebcam(false);
  }

  async startMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.micStream = stream;
    this.sources = this.sources.withMic(true);
    return stream;
  }

  currentMic(): MediaStream | null {
    return this.micStream;
  }

  stopMic(): void {
    this.micStream?.getTracks().forEach(track => track.stop());
    this.micStream = null;
    this.sources = this.sources.withMic(false);
  }

  private endScreen(): void {
    this.screenCapture = null;
    this.sources = this.sources.withScreen(false);
    for (const listener of this.endedListeners) listener();
  }
}

export const capture = new CaptureAdapter();

export const webcamPort: WebcamPort = {
  start: () => capture.startWebcam(),
  stop: () => capture.stopWebcam(),
  current: () => capture.currentWebcam(),
};

export const microphonePort: MicrophonePort = {
  start: () => capture.startMic(),
  stop: () => capture.stopMic(),
  current: () => capture.currentMic(),
};
