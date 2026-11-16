// The Bluesky side of publishing, as the use case needs to see it.
//
// A port, not a client: the use case sequences "upload the MP4, wait for the
// video service to finish, write the post", and everything that needs a browser,
// an access token or the network sits behind this. That is what lets the
// sequencing be tested in node against a fake, and it is the seam the
// OAuth-backed XRPC client (and the `video.bsky.app` upload) will sit behind.

import type { BlobRef, PostRecord } from '../domain/bluesky/BlueskyPost.js';
import type { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';

// `app.bsky.video.defs#jobStatus`: all values not listed here mean "still going".
export type VideoJobState =
  | 'JOB_STATE_CREATED' | 'JOB_STATE_ENCODING' | 'JOB_STATE_ENCODED'
  | 'JOB_STATE_SCANNING' | 'JOB_STATE_SCANNED' | 'JOB_STATE_UPLOADING'
  | 'JOB_STATE_UPLOADED' | 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED';

export type VideoFailureCode =
  | 'validation_failure' | 'encoding_failure' | 'pds_upload_failure'
  | 'pds_upload_unsupported_blob_size' | 'generic_failure';

/** Where the video service has got to, with the blob once it has written it. */
export interface VideoJob {
  jobId: string;
  state: VideoJobState | string;
  progress?: number;
  blob?: BlobRef | null;
  error?: string;
  failureCode?: VideoFailureCode | string;
  message?: string;
}

export interface PostedPost {
  uri: string;
  cid: string;
}

export interface BlueskyService {
  /** Hand the MP4 to the video service; it answers with the job to watch. */
  uploadVideo(video: PublishableVideo): Promise<VideoJob>;
  /** Ask the video service where a job has got to. */
  videoJob(jobId: string): Promise<VideoJob>;
  /** Write the post that carries the finished video. */
  createPost(record: PostRecord): Promise<PostedPost>;
}
