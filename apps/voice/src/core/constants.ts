export const VOICE_MODE_STATE = {
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
} as const;

export type VoiceModeState = (typeof VOICE_MODE_STATE)[keyof typeof VOICE_MODE_STATE];

export const VOICE_CONNECTION_STATE = {
  CONNECTED: "connected",
  RECOVERING: "recovering",
  FAILED: "failed",
} as const;

export type VoiceConnectionState =
  (typeof VOICE_CONNECTION_STATE)[keyof typeof VOICE_CONNECTION_STATE];

export const VOICE_ENDPOINTING_MODE = {
  CLIENT_VAD: "client",
  PROVIDER: "provider",
} as const;

export type VoiceEndpointingMode =
  (typeof VOICE_ENDPOINTING_MODE)[keyof typeof VOICE_ENDPOINTING_MODE];

export const LEARNER_TRANSCRIPT_STATUSES = {
  PARTIAL: "partial",
  FINAL: "final",
} as const;

export type LearnerTranscriptStatus =
  (typeof LEARNER_TRANSCRIPT_STATUSES)[keyof typeof LEARNER_TRANSCRIPT_STATUSES];
