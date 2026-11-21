// The picture already on the person's clipboard, read from the host.
//
// It is the first picture source an agent has — a file or a drag comes later — and it
// is read here rather than in the page on purpose. A browser hands a picture to a page
// only while the window has focus and a hand has just touched it; a chat has neither,
// because the person is typing in their editor while the app watches from another
// window. The server is the person's own program and may read the operating system's
// clipboard directly, which is the same fact the person put there.
//
// One command per platform, each the platform's own reader: macOS `osascript` returns
// the PNGf flavour as a hex dump, Windows PowerShell returns the picture as base64, and
// Linux pipes PNG bytes from `wl-paste` or `xclip`. A clipboard holding text, or holding
// nothing, is not an error — it answers the same refusal a reader that found no picture
// gives. Nothing is written to disk, and nothing but the bytes leaves this module.
//
// The picture is PNG by the time it is handed on: every reader asks for PNG, so the app
// has one flavour to decode.

import { execFile } from 'node:child_process';
import { Buffer } from 'node:buffer';

/** A picture the clipboard held: PNG bytes, and the flavour they came in. */
export interface ClipboardPicture {
  readonly type: string;
  readonly bytes: Buffer;
}

/** What reading the clipboard answered: the picture, or why there is none. */
export type ClipboardRead =
  | { readonly ok: true; readonly picture: ClipboardPicture }
  | { readonly ok: false; readonly reason: string };

/** Runs one reader and answers everything it wrote, or rejects with its failure. */
export type CommandRunner = (file: string, args: readonly string[]) => Promise<Buffer>;

export interface ReadOptions {
  /** The host's platform, `process.platform` in a real call. */
  readonly platform?: NodeJS.Platform;
  /** How a command is run; the platform's own reader in a real call. */
  readonly run?: CommandRunner;
}

/** One way of reading a picture from the clipboard. */
interface Reader {
  readonly file: string;
  readonly args: readonly string[];
  /** How this reader's output becomes PNG bytes, or null when it held no picture. */
  readonly parse: (stdout: Buffer) => Buffer | null;
}

/** A clipboard picture bigger than this is refused rather than put through the protocol. */
const MAX_BYTES = 32 * 1024 * 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** How much a reader may write: the hex dump is twice the picture, plus its wrapper. */
const MAX_OUTPUT = MAX_BYTES * 2 + 1024;

const APPLE_SCRIPT_DATA = /^«data\s*PNGf([0-9A-Fa-f]*)»$/;

/** The picture on the clipboard, or a reason the agent can pass on. */
export async function readClipboardPicture(options: ReadOptions = {}): Promise<ClipboardRead> {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? runCommand;
  const readers = readersFor(platform);
  if (!readers.length) {
    return { ok: false, reason: `the clipboard can be read on macOS, Windows and Linux, not on ${platform}` };
  }

  let missing = 0;
  for (const reader of readers) {
    let stdout: Buffer;
    try {
      stdout = await run(reader.file, reader.args);
    } catch (error) {
      // The reader ran but had nothing of the kind asked for — a clipboard holding text,
      // or a picture in a flavour it does not take. The next reader may still find one.
      if (isMissingFile(error)) missing++;
      continue;
    }
    const bytes = asPng(reader.parse(stdout));
    if (!bytes) continue;
    if (bytes.length > MAX_BYTES) {
      return { ok: false, reason: `that picture is ${megabytes(bytes.length)} MB — too large to place` };
    }
    return { ok: true, picture: { type: 'image/png', bytes } };
  }

  if (missing === readers.length) {
    return { ok: false, reason: `no clipboard reader is installed — ${installHint(platform)}` };
  }
  return { ok: false, reason: 'the clipboard holds no picture DemoClip can read' };
}

function readersFor(platform: NodeJS.Platform): readonly Reader[] {
  switch (platform) {
    case 'darwin':
      return [{
        file: 'osascript',
        args: ['-e', 'the clipboard as «class PNGf»'],
        parse: parseAppleScript,
      }];
    case 'win32':
      return [{
        file: 'powershell',
        args: [
          '-NoProfile', '-NonInteractive', '-STA', '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; '
            + '$image = [System.Windows.Forms.Clipboard]::GetImage(); '
            + 'if ($image -ne $null) { $stream = New-Object System.IO.MemoryStream; '
            + '$image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); '
            + '[Convert]::ToBase64String($stream.ToArray()) }',
        ],
        parse: parseBase64,
      }];
    case 'linux':
      // Wayland first, then X11. A missing reader is not the end: the other may exist.
      return [
        { file: 'wl-paste', args: ['--no-newline', '--type', 'image/png'], parse: raw },
        { file: 'xclip', args: ['-selection', 'clipboard', '-t', 'image/png', '-o'], parse: raw },
      ];
    default:
      return [];
  }
}

/** `«data PNGf89504E47…»` — how AppleScript writes the picture as data. */
function parseAppleScript(stdout: Buffer): Buffer | null {
  // The dump is one long line, but whitespace is dropped anyway so a wrapped one still
  // reads rather than becoming "no picture".
  const match = APPLE_SCRIPT_DATA.exec(stdout.toString('utf8').replace(/\s+/g, ''));
  if (!match || match[1].length === 0 || match[1].length % 2 !== 0) return null;
  return Buffer.from(match[1], 'hex');
}

/** What PowerShell's `[Convert]::ToBase64String` wrote, or nothing when it wrote none. */
function parseBase64(stdout: Buffer): Buffer | null {
  const text = stdout.toString('utf8').trim();
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  const bytes = Buffer.from(text, 'base64');
  return bytes.length > 0 ? bytes : null;
}

/** A reader that already returns the picture's bytes — `wl-paste`, `xclip`. */
function raw(stdout: Buffer): Buffer | null {
  return stdout.length > 0 ? stdout : null;
}

/** The bytes, when they really are a PNG: a reader that gave something else gave nothing. */
function asPng(bytes: Buffer | null): Buffer | null {
  if (!bytes || bytes.length <= PNG_MAGIC.length) return null;
  return bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) ? bytes : null;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function installHint(platform: NodeJS.Platform): string {
  return platform === 'linux'
    ? 'install wl-clipboard or xclip to let the server read the clipboard'
    : 'the reader this platform needs was not found';
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function runCommand(file: string, args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], {
      encoding: 'buffer',
      maxBuffer: MAX_OUTPUT,
      timeout: 15_000,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}