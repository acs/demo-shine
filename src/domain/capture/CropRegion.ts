// The crop: the part of the picture a take records.
//
// The region is normalised to the picture — 0..1 on both axes — so it survives a
// change of capture size. It is a rule, not a view type: a region is never empty
// and never reaches outside the picture. The view drags it; the compositor reads
// it; the domain keeps it honest.

export class CropRegion {
  /** The whole picture. */
  static readonly FULL = new CropRegion(0, 0, 1, 1);

  private constructor(
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
  ) {}

  /** A region from normalised coordinates. Rejects an empty or out-of-picture one. */
  static of(x: number, y: number, w: number, h: number): CropRegion {
    const values = [x, y, w, h];
    if (!values.every(Number.isFinite)) throw new Error('A crop region needs four finite numbers');
    if (w <= 0 || h <= 0) throw new Error('A crop region is never empty');
    if (x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) {
      throw new Error('A crop region stays inside the picture');
    }
    return new CropRegion(x, y, w, h);
  }

  /** The whole picture, or the region as it is. */
  static from(x: number, y: number, w: number, h: number): CropRegion {
    if (x === 0 && y === 0 && w === 1 && h === 1) return CropRegion.FULL;
    return CropRegion.of(x, y, w, h);
  }

  /** Whether this is the whole picture. */
  get isFull(): boolean {
    return this === CropRegion.FULL || (this.x === 0 && this.y === 0 && this.w === 1 && this.h === 1);
  }

  /** A copy with a new box. The view's drag builds one of these. */
  with(x: number, y: number, w: number, h: number): CropRegion {
    return CropRegion.from(x, y, w, h);
  }

  equals(other: CropRegion): boolean {
    return this.x === other.x && this.y === other.y && this.w === other.w && this.h === other.h;
  }
}
