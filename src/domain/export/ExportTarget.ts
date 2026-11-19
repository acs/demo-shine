// The two containers an export can write.
//
// The name is the domain's: a use case may say "write MP4" without importing the
// codec table. The codecs that follow from the name stay in infra/export-target.ts.

export type ExportTarget = 'webm' | 'mp4';
