# Port Contracts

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md)

These are the interfaces the use cases own. They are written in TypeScript notation for clarity; the implementation must keep the same shape. A port is implemented by an adapter in `src/infra/` and faked in tests. A port must not import the DOM or a view module.

## Capture

```ts
export interface CaptureSession {
  readonly stream: MediaStream;
  readonly hasAudio: boolean;
}

export interface CapturePort {
  /** Ask for a screen share. Rejects when the person cancels. */
  start(): Promise<CaptureSession>;
  /** Release the share and its tracks. */
  stop(): void;
  /** The share held now, or null. */
  current(): CaptureSession | null;
  /** Called when the person stops sharing from the browser's own UI. */
  onEnded(listener: () => void): () => void;
}
```

## Webcam and microphone

```ts
export interface WebcamPort {
  start(): Promise<MediaStream>;
  stop(): void;
  current(): MediaStream | null;
}

export interface MicrophonePort {
  start(): Promise<MediaStream>;
  stop(): void;
  current(): MediaStream | null;
}
```

## Recording

```ts
export interface TakeRecorderPort {
  start(stream: MediaStream): void;
  /** Stop and resolve with the recorded bytes. */
  stop(): Promise<Blob>;
  isRecording(): boolean;
}
```

## Compositor

```ts
export interface CompositorInput {
  readonly screen: MediaStream | null;
  readonly webcam: MediaStream | null;
  readonly mic: MediaStream | null;
  readonly region: CropRegion;
  readonly audio: boolean;
}

export interface CompositorSession {
  readonly stream: MediaStream;
  readonly hasAudio: boolean;
}

export interface CompositorPort {
  /** Draw the crop and the webcam bubble, mix the audio, and return the stream to record. */
  open(input: CompositorInput): CompositorSession;
  close(): void;
}
```

The compositor owns the crop canvas and the audio graph. The webcam bubble's drawing is injected by the composition root; the compositor does not import a view module.

## Probing and time

```ts
export interface TakeProbePort {
  /** A blob's duration in seconds. Rejects when the blob cannot be read. */
  measure(blob: Blob): Promise<number>;
}

export interface Timer {
  cancel(): void;
}

export interface ClockPort {
  now(): number;
  setTimeout(callback: () => void, ms: number): Timer;
}
```

## Encoding

```ts
export interface ExportStats {
  readonly bytes: number;
  readonly seconds: number;
}

export interface EncodedVideo {
  readonly blob: Blob;
  readonly stats: ExportStats;
}

export interface Frame {
  readonly sourceTime: number;
  readonly outputTime: number;
}

export interface EncodeOptions {
  readonly target: ExportTarget;
}

export interface EncoderPort {
  /** Whether this browser can encode at all. */
  available(): boolean;
  /** Encode the plan. The renderer draws the annotations and the preview. */
  encode(plan: ExportPlan, renderer: FrameRendererPort, options: EncodeOptions): Promise<EncodedVideo>;
}

export interface FrameRendererPort {
  /** Draw the annotations for a frame onto the encoder's canvas. */
  draw(context: CanvasRenderingContext2D, frame: Frame): void;
  /** Show the frame on the preview canvas. */
  preview(context: CanvasRenderingContext2D): void;
}
```

The encoder adapter calls `renderer.draw` for each frame and `renderer.preview` for the live preview. It imports no `ui/` module; the composition root supplies the renderer.

## Downloading

```ts
export interface DownloadPort {
  save(blob: Blob, filename: string): void;
}
```

## Keeping the clip

```ts
export interface StoredClip {
  readonly clip: ClipSnapshot;
  readonly audio: boolean;
}

export interface KeptClipPort {
  saveTake(clip: Clip, index: number, audio: boolean): Promise<void>;
  saveMeta(clip: Clip, audio: boolean): Promise<void>;
  saveClip(clip: Clip, audio: boolean): Promise<void>;
  load(): Promise<StoredClip | null>;
  clear(): Promise<void>;
}
```

The adapter is the existing `src/infra/clip-store.ts`. The port's `saveClip` is the "write the whole clip now" call used before a sign-in; `saveTake` and `saveMeta` are the incremental writes the keep use case makes as the clip changes.

## Bluesky

The publish use case keeps the existing `BlueskyService` port in `src/application/bluesky-service.ts`:

```ts
export interface BlueskyService {
  uploadVideo(video: PublishableVideo): Promise<VideoJob>;
  videoJob(jobId: string): Promise<VideoJob>;
  createPost(record: PostRecord): Promise<PostedPost>;
}
```

The adapter is `src/infra/bluesky.ts`, lazy-loaded by the publish flow. The port does not change in this refactor.

## Dependency rule

- `domain/` imports nothing from `application/`, `infra/` or `ui/`.
- `application/` imports `domain/` and its own ports; it does not import `infra/` or `ui/`.
- `infra/` imports `domain/` and `application/`; it does not import `ui/`.
- `ui/` imports `domain/` and `application/`; it does not import `infra/` directly. The composition root injects the adapters.
- `main.ts` is the only module that imports all four layers.
