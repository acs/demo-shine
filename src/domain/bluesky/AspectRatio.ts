// The width-to-height ratio a Bluesky post shows its media at.
//
// `app.bsky.embed.defs#aspectRatio` asks for two whole numbers, each at least
// one, and says they only *stand for* a ratio — it need not be the media's real
// pixel size. A screen capture's size is a perfectly good ratio, but the reduced
// form (1280x720 → 16x9) is tidier to store and to read, so the class can divide
// both sides by their common divisor without ever reaching zero.

export class AspectRatio {
  private constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** From two whole sides of at least one. Anything else is not a ratio. */
  static of(width: number, height: number): AspectRatio {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error(`an aspect ratio needs whole sides of at least one, got ${width}x${height}`);
    }
    return new AspectRatio(width, height);
  }

  /** The same ratio in its smallest whole terms: 1280x720 becomes 16x9. */
  reduced(): AspectRatio {
    const d = gcd(this.width, this.height);
    return new AspectRatio(this.width / d, this.height / d);
  }

  equals(other: AspectRatio): boolean {
    return this.width === other.width && this.height === other.height;
  }
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
