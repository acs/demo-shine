// The keep range: IN and OUT, held as fractions of the clip.
//
// The app drags sliders measured in 0..1000 and stores what they mean as a
// fraction. Those two units used to be loose in the callers — the minimum gap
// expressed in slider units while the range was a fraction — so here the fraction
// is the value and the slider is one of its views, and the gap is stated once.

export class Trim {
  /** A hundredth of the clip: ten units of the slider. */
  static readonly MIN_GAP = 0.01;

  static readonly SLIDER_MAX = 1000;

  private constructor(
    readonly start: number,
    readonly end: number,
  ) {}

  /** From fractions, kept inside the clip. */
  static of(start: number, end: number): Trim {
    const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
    return new Trim(clamp(start), clamp(end));
  }

  /** From the slider positions the user dragged. */
  static fromSlider(start: number, end: number): Trim {
    return Trim.of(start / Trim.SLIDER_MAX, end / Trim.SLIDER_MAX);
  }

  /** The slider positions that show this range. */
  get slider(): { start: number; end: number } {
    return { start: this.start * Trim.SLIDER_MAX, end: this.end * Trim.SLIDER_MAX };
  }

  /** As a fraction of the clip. */
  get length(): number {
    return this.end - this.start;
  }

  /**
   * IN and OUT at least `gap` apart, moving the handle the user did *not* drag —
   * the other one stays where they left it.
   */
  normalized(moved: 'start' | 'end', gap: number = Trim.MIN_GAP): Trim {
    if (this.start < this.end - gap) return this;
    return moved === 'start'
      ? Trim.of(this.end - gap, this.end)
      : Trim.of(this.start, this.start + gap);
  }

  /** How long the range is in a clip of this duration. */
  seconds(durationSeconds: number): number {
    return this.length * durationSeconds;
  }
}
