# Contract — the image annotation

What the image kind is, what it promises, and where its picture is kept. The seam it
fits is in `annotation-plugin.md`; the rules behind it are in `data-model.md`.

## 1. The kind (pure)

`src/domain/annotation/ImageAnnotation.ts`

```ts
export interface ImageGeometry {
  readonly imageId: string;        // which kept picture — resolved to bytes in infra/
  readonly x: number;              // the rect, as fractions of the picture
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly imageAspect: number;    // the picture's own pixel width ÷ height
  readonly pictureAspect: number;  // the recorded picture's, when it was made
}

export class ImageAnnotation extends Annotation {
  static readonly id = 'image';

  static create(span: Span, geometry: ImageGeometry, id?: string): ImageAnnotation | null;
  static restore(stored: StoredAnnotation): ImageAnnotation | null;

  get isUsable(): boolean;
  get geometry(): ImageGeometry;

  handles(): readonly AnnotationHandle[];                 // nw, ne, se, sw
  withHandle(end: string, to: Point, options?: HandleOptions): ImageAnnotation | null;
  movedBy(dx: number, dy: number): ImageAnnotation | null;
  withSpan(span: Span): ImageAnnotation;
  duplicated(span: Span): ImageAnnotation;
  hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean;
  stored(): StoredAnnotation;
}
```

**Guarantees**

- **no bytes and no canvas**: the kind is an id and numbers, so `src/domain/` stays
  pure (Principle II, spec FR-016 is satisfied by `infra/`, below);
- **normalise on create**: the rect is clamped into `[0, 1]²`, the ratios kept positive,
  and a rect below a small minimum is refused — a stray one is not an image;
- **keep proportions** by default, **free** when `options.free`: from a new width `w`,
  `height = w · pictureAspect ÷ imageAspect`; the corner opposite the one dragged is the
  anchor (spec FR-015, clarification Q2);
- **a drag past the anchor** clamps to a minimum rect rather than flipping it negative;
- **a rect dragged past the edge** is kept, pulled inside — it is not lost;
- **`duplicated` copies numbers, not bytes**: the copy carries the same `imageId`, so
  pasting an image is as cheap as pasting an arrow (spec FR-005);
- **`withSpan` never makes it unusable** — the stretch says when it shows, not what
  shape it is;
- **`restore` is forgiving**: a damaged or unknown stored image reads back as nothing
  rather than throwing (spec FR-012).

## 2. How a picture is chosen and made

`src/ui/annotating/image-plugin.ts` — the `AnnotationPlugin` for `'image'`.

```ts
export const imagePlugin: AnnotationPlugin;   // id 'image'
```

**Guarantees**

- `begin` offers the three ways the spec names (FR-014, clarification Q1), live only
  while the image is being added: a hidden `<input type="file" accept="image/*">`, a
  `paste` listener for a clipboard image, and `dragover`/`drop` on the preview;
- a picture that cannot be read is refused with a message through `abandon`, and
  nothing is added (spec edge case);
- a picture larger than twice the clip's picture is downscaled once, on add, before it
  is kept (D10); the user is told;
- the annotation is placed **centred**, at a default width fraction, keeping its
  proportions, and put in hand — so the shared move/resize can follow at once;
- the picture is written with `images.put(id, blob)` **before** the annotation is added,
  so the meta write that follows already carries a resolvable `imageId`;
- the plugin attaches its own listeners and the shared canvas learns nothing about a
  file — this is the "some interactivity if needed" of spec FR-013.

## 3. Where the picture is kept

`src/infra/images.ts`; the port in `application/ports/ImageStorePort.ts`.

```ts
export interface StoredImage {
  readonly id: string;
  readonly blob: Blob;
}

export interface ImageStorePort {
  put(id: string, blob: Blob): Promise<void>;
  all(): Promise<StoredImage[]>;
}

/** The adapter also holds the decoded cache. */
export const images: {
  put(id: string, blob: Blob): Promise<void>;   // store once, decode into the cache
  get(id: string): CanvasImageSource | null;    // the decoded picture, or null
  ready(): Promise<void>;                        // every kept picture decoded — the export awaits
  load(): Promise<void>;                         // read every kept picture into the cache (restore)
  clear(): Promise<void>;                        // let the store and the cache go with the clip
};
```

**Guarantees**

- the picture is written **once**, in its own IndexedDB object store (`images`, DB
  version 3), apart from the small half — so a change writes a few bytes and never the
  picture (spec FR-023);
- `imageId` is unique for the session, made like an annotation id;
- the cache holds **one decoded picture per id**, made once and drawn many times, so a
  frame is a `drawImage` and not a decode (spec SC-008);
- `images.clear()` is called where the clip is let go; `clip-store.ts`'s `clear()`
  clears the store in the same act;
- a picture missing from the store draws nothing and does not fail the open — the
  annotation is kept, its picture is simply not there.

## 4. Drawing, and the export

- the image renderer is the plugin's `renderer`: it resolves `imageId` through
  `images.get(id)` and `drawImage`s it into the rect, scaled to `w × h` — the same call
  on the preview canvas and on the export canvas, so the file matches the review
  (FR-011, SC-005);
- a picture not yet decoded is **skipped**, not thrown on;
- the export flow awaits `images.ready()` **before** it starts encoding, because the
  export draws frames in a tight loop and a decode cannot happen inside a frame.

## 5. The stored shape

```ts
// StoredAnnotation.geometry for the image kind
{ imageId: string, x: number, y: number, width: number, height: number,
  imageAspect: number, pictureAspect: number }
```

**Guarantees**

- it is plain numbers plus an id, so it lives in the clip's **small half** (`Meta`) and
  the record is unchanged in shape — `StoredAnnotation.geometry` is already `unknown`;
- a stored clip from a version without images reads back unchanged (its annotations are
  arrows);
- `kinds.ts` registers `ImageAnnotation` beside `Arrow`, so `annotationFrom` rebuilds
  both and a clip with either opens.

## 6. Deleting and the lifetime of a picture

- removing an image annotation takes the annotation out of the clip and **nothing
  else**: the picture stays until the session ends, so the one undo can bring the image
  back (spec FR-006, D12);
- the pictures and the decoded cache are let go together with the clip — the same
  lifetime the takes' object URLs have.

## 7. The clip is untouched

- placing an image never re-encodes the recording (spec FR-017): the annotation is
  drawn over the picture by the layer, exactly as an arrow is, and the takes' bytes are
  never rewritten;
- the image kind changes nothing about cuts, takes, playback or publishing.
