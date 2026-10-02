import type { LearnerTranscriptStatus } from "./constants";

export type LearnerTranscriptRevision = {
  text: string;
  turnId: string;
  segmentId: string;
  revision: number;
  status: LearnerTranscriptStatus;
  jobId?: string;
};

export type SpeechAlignmentWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type MentorSpeechAlignment = {
  turnId: string;
  sequence: number;
  words: SpeechAlignmentWord[];
};

export type MentorSpeechPresentation = MentorSpeechAlignment & {
  activeWordIndex: number | null;
};

export type PcmFormat = {
  sr: number;
  channels: number;
  format: "pcm_s16le";
};

export type PcmChunkMeta = {
  seq: number;
  sr: number;
  samples: number;
  ts_ms: number;
};

export type SpeechBoundary = {
  boundarySeq: number;
  tsMs: number;
  /** Sequence of the last chunk handed to `onChunk` before this boundary, or -1 if none. */
  lastChunkSeq: number;
};
