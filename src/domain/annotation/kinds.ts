// The annotation family's rules: what a kind is, and which kinds exist.
//
// A kind is identified by a string — 'arrow' today — and is described twice under
// that id: here, by the rules that need no canvas (how a geometry is put back
// inside the picture, whether it is worth keeping), and in the view
// (`src/ui/annotation-layer.ts`) by how it is drawn and picked. The split is forced
// by the rule the rest of the domain follows: `src/domain/` may not touch the DOM,
// and how a thing looks cannot live beside what it is allowed to be.
//
// Adding a kind is a new module here, a `register` call, a renderer in the view and
// a `registerRenderer` call — and nothing that already exists is edited. That is
// the promise the first kind is written to keep.

import { arrowKind } from './Arrow.js';

export interface AnnotationKind<G> {
  /** The id both registries key on, e.g. 'arrow'. */
  readonly id: string;
  /** The geometry a fresh one starts from, before the user's gesture shapes it. */
  defaultGeometry(): G;
  /** A geometry put back inside the picture. Never throws. */
  normalize(g: G): G;
  /** Is this geometry worth keeping, or a stray click? */
  isUsable(g: G): boolean;
}

/** A kind with its geometry erased, which is how the registry holds them. */
export interface AnyAnnotationKind {
  readonly id: string;
  defaultGeometry(): unknown;
  normalize(g: unknown): unknown;
  isUsable(g: unknown): boolean;
}

const kinds = new Map<string, AnyAnnotationKind>();

/** Teach the family a kind. The same id again replaces it, which is what a test wants. */
export function register<G>(kind: AnnotationKind<G>): void {
  kinds.set(kind.id, {
    id: kind.id,
    defaultGeometry: () => kind.defaultGeometry(),
    normalize: g => kind.normalize(g as G),
    isUsable: g => kind.isUsable(g as G),
  });
}

/**
 * The rules of a kind, or null for an id this version does not know — a stored clip
 * from a later version degrades rather than throwing.
 */
export function kindOf(id: string): AnyAnnotationKind | null {
  return kinds.get(id) ?? null;
}

/** Which kinds this build knows, for tests and for a picker. */
export function registeredKinds(): readonly string[] {
  return [...kinds.keys()];
}

// The arrow is the first kind, and registering it here is what makes it the first.
// Arrow.ts reaches back only for the type, which is erased, so there is no cycle.
register(arrowKind);
