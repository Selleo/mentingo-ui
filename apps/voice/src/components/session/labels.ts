import { VOICE_MODE_STATE, type VoiceModeState } from "../../core/constants";

export type VoiceSessionLabels = {
  states: Record<VoiceModeState, string>;
  task: string;
  check: string;
  micOn: string;
  muted: string;
  mute: string;
  unmute: string;
  exit: string;
  close: string;
  recoveryFailedTitle: string;
  recoveryFailedDescription: string;
  restart: string;
};

export const DEFAULT_VOICE_SESSION_LABELS: VoiceSessionLabels = {
  states: {
    [VOICE_MODE_STATE.IDLE]: "Ready",
    [VOICE_MODE_STATE.LISTENING]: "Listening",
    [VOICE_MODE_STATE.THINKING]: "Thinking",
    [VOICE_MODE_STATE.SPEAKING]: "Speaking",
  },
  task: "Task description",
  check: "Check",
  micOn: "Mic on",
  muted: "Muted",
  mute: "Mute",
  unmute: "Unmute",
  exit: "Exit voice mode",
  close: "Close",
  recoveryFailedTitle: "Voice session disconnected",
  recoveryFailedDescription:
    "The connection could not be restored. Restart the voice session to continue.",
  restart: "Restart session",
};

export type VoiceSessionLabelsInput = Partial<Omit<VoiceSessionLabels, "states">> & {
  states?: Partial<VoiceSessionLabels["states"]>;
};

export function resolveVoiceSessionLabels(labels?: VoiceSessionLabelsInput): VoiceSessionLabels {
  return {
    ...DEFAULT_VOICE_SESSION_LABELS,
    ...labels,
    states: { ...DEFAULT_VOICE_SESSION_LABELS.states, ...labels?.states },
  };
}
