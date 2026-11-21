import { describe, expect, it } from 'vitest';

import { readClipboardPicture, type CommandRunner } from './clipboard.js';

// Reading the clipboard, without a clipboard: each platform's reader is a command, so
// the check stands in a runner that answers what that command would have written. What
// is proved is the part that is ours — which command is asked, and how its output
// becomes the picture — not that macOS or Windows answered on this machine.

/** A PNG's opening bytes, so a reader's output is a picture and not a stray string. */
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,   // the magic
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,   // and the IHDR that follows it
]);

/** What AppleScript prints for a picture: `«data PNGf…»`, with the bytes in hex. */
function appleScriptDump(bytes: Buffer): Buffer {
  return Buffer.from(`\u00abdata PNGf${bytes.toString('hex').toUpperCase()}\u00bb\n`, 'utf8');
}

function missing(file: string): Error {
  const error = new Error(`spawn ${file} ENOENT`);
  (error as NodeJS.ErrnoException).code = 'ENOENT';
  return error;
}

/** A runner that answers per command name, and reports a command it was not given. */
function runner(answers: Readonly<Record<string, Buffer | Error>>): CommandRunner {
  return async file => {
    const answer = answers[file];
    if (answer instanceof Error) throw answer;
    if (!answer) throw missing(file);
    return answer;
  };
}

/** A reader that ran and found nothing of the kind asked for. */
function emptyClipboard(): Error {
  return new Error('the clipboard holds no picture');
}

describe('readClipboardPicture', () => {
  it('reads the PNGf flavour AppleScript writes, and keeps the bytes', async () => {
    const read = await readClipboardPicture({ platform: 'darwin', run: runner({ osascript: appleScriptDump(PNG) }) });

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.picture.type).toBe('image/png');
    expect(read.picture.bytes.equals(PNG)).toBe(true);
  });

  it('reads the picture even when the dump is wrapped', async () => {
    const dump = `\u00abdata PNGf${PNG.toString('hex')}\u00bb`;
    const wrapped = Buffer.from(dump.replace(/(.{20})/g, '$1\n'), 'utf8');
    const read = await readClipboardPicture({ platform: 'darwin', run: runner({ osascript: wrapped }) });

    expect(read.ok).toBe(true);
    if (read.ok) expect(read.picture.bytes.equals(PNG)).toBe(true);
  });

  it('says there is no picture when the clipboard holds text instead', async () => {
    // `osascript` exits non-zero: `the clipboard as «class PNGf»` cannot be made.
    const read = await readClipboardPicture({ platform: 'darwin', run: runner({ osascript: emptyClipboard() }) });
    expect(read).toEqual({ ok: false, reason: 'the clipboard holds no picture DemoClip can read' });
  });

  it('says there is no picture for output that is not a PNG', async () => {
    for (const stdout of [Buffer.from('hello\n'), Buffer.from('\u00abdata PNGfabc\u00bb'), Buffer.from('\u00abdata TIFF 89504e47\u00bb')]) {
      const read = await readClipboardPicture({ platform: 'darwin', run: runner({ osascript: stdout }) });
      expect(read.ok).toBe(false);
    }
  });

  it('reads the base64 PowerShell prints on Windows', async () => {
    const read = await readClipboardPicture({ platform: 'win32', run: runner({ powershell: Buffer.from(`${PNG.toString('base64')}\r\n`) }) });

    expect(read.ok).toBe(true);
    if (read.ok) expect(read.picture.bytes.equals(PNG)).toBe(true);
  });

  it('takes the picture wl-paste or xclip gives on Linux, and falls back when one is missing', async () => {
    const wayland = await readClipboardPicture({ platform: 'linux', run: runner({ 'wl-paste': PNG }) });
    expect(wayland.ok).toBe(true);

    // No Wayland reader: the X11 one is asked instead, not given up on.
    const x11 = await readClipboardPicture({ platform: 'linux', run: runner({ xclip: PNG }) });
    expect(x11.ok).toBe(true);
    if (x11.ok) expect(x11.picture.bytes.equals(PNG)).toBe(true);
  });

  it('names the reader to install when Linux has neither', async () => {
    const read = await readClipboardPicture({ platform: 'linux', run: runner({}) });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toContain('wl-clipboard');
  });

  it('refuses a platform whose clipboard the server does not read, rather than guessing', async () => {
    const read = await readClipboardPicture({ platform: 'aix', run: runner({}) });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toContain('aix');
  });
});