// A recorded take: one press of Record.
//
// It has identity — a session's takes are numbered, and the element, the waveform
// and the export all have to mean the same one — and it has a lifetime: the blob
// it holds and the object URL that plays it. The URL is made and revoked by
// TakeRepository, which is the only thing that reaches the browser for it.
//
// A take has to have a length, because the joined timeline is the sum of them: a
// zero-length take would make every position after it wrong, so it cannot be
// constructed.

export class Take {
  private constructor(
    readonly id: number,
    readonly blob: Blob,
    readonly url: string,
    readonly duration: number,
  ) {}

  static of(id: number, blob: Blob, url: string, duration: number): Take {
    if (!(duration > 0)) throw new Error(`a take needs a length, got ${duration}`);
    return new Take(id, blob, url, duration);
  }

  /** Two takes are the same take when they are the same recording, not the same bytes. */
  equals(other: Take): boolean {
    return this.id === other.id;
  }
}
