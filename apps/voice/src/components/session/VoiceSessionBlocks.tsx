import { AlertTriangle, BookOpen, ClipboardCheck, Mic, MicOff, RefreshCw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { VOICE_MODE_STATE, type VoiceModeState } from "../../core/constants";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { AgentAudioVisualizerAura } from "../visualizers/agent-audio-visualizer-aura";
import { AgentAudioVisualizerWave } from "../visualizers/agent-audio-visualizer-wave";

import { DEFAULT_VOICE_SESSION_LABELS, type VoiceSessionLabels } from "./labels";
import { VOICE_SESSION_TEST_IDS } from "./test-ids";

import type { ReactNode } from "react";

export const VOICE_VISUALIZER_COLOR = "var(--primary)";
export const VOICE_ACTIVITY_THRESHOLD = 0.04;

const MOBILE_CONTROL_CLASS_NAME =
  "size-12 rounded-full bg-white text-primary-800 shadow-none transition-transform hover:scale-105 hover:bg-primary-50 hover:text-primary-800";
const MOBILE_CHECK_CLASS_NAME =
  "size-12 rounded-full shadow-none transition-transform hover:scale-105";

const clampLevel = (level: number) => Math.max(0, Math.min(1, level));

export type VoiceSessionStateTitleProps = {
  state: VoiceModeState;
  labels?: Pick<VoiceSessionLabels, "states">;
  className?: string;
};

export function VoiceSessionStateTitle({
  state,
  labels = DEFAULT_VOICE_SESSION_LABELS,
  className,
}: VoiceSessionStateTitleProps) {
  return (
    <motion.div
      key={state}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("text-center", className)}
    >
      <h3 className="text-xl font-semibold text-neutral-900">{labels.states[state]}</h3>
    </motion.div>
  );
}

export type VoiceSessionVisualizerProps = {
  state: VoiceModeState;
  voiceLevel: number;
  mentorVoiceLevel: number;
  isMicMuted?: boolean;
  color?: string;
  className?: string;
};

export function VoiceSessionVisualizer({
  state,
  voiceLevel,
  mentorVoiceLevel,
  isMicMuted = false,
  color = VOICE_VISUALIZER_COLOR,
  className,
}: VoiceSessionVisualizerProps) {
  const isLocalVoiceActive = voiceLevel >= VOICE_ACTIVITY_THRESHOLD;
  const isListening = !isMicMuted && (state === VOICE_MODE_STATE.LISTENING || isLocalVoiceActive);
  const voiceVolume = !isMicMuted ? clampLevel(voiceLevel) : 0;
  const mentorVolume = state === VOICE_MODE_STATE.SPEAKING ? clampLevel(mentorVoiceLevel) : 0;
  const auraState = state === VOICE_MODE_STATE.SPEAKING ? "speaking" : "thinking";

  return (
    <div className={cn("relative flex min-h-56 w-full items-center justify-center", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative flex size-64 items-center justify-center"
      >
        <motion.div
          aria-hidden={!isListening}
          animate={{ opacity: isListening ? 1 : 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <AgentAudioVisualizerWave
            state="speaking"
            size="lg"
            color={color}
            colorShift={0.08}
            lineWidth={2}
            blur={0.75}
            volume={voiceVolume}
            className="w-80"
          />
        </motion.div>
        <motion.div
          aria-hidden={isListening}
          animate={{ opacity: isListening ? 0 : 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <AgentAudioVisualizerAura
            state={auraState}
            size="lg"
            color={color}
            colorShift={0}
            themeMode="light"
            volume={mentorVolume}
            className="scale-110"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

export type VoiceSessionConnectionAlertProps = {
  isRestarting?: boolean;
  onRestart: () => void;
  labels?: Pick<
    VoiceSessionLabels,
    "recoveryFailedTitle" | "recoveryFailedDescription" | "restart"
  >;
  className?: string;
};

export function VoiceSessionConnectionAlert({
  isRestarting = false,
  onRestart,
  labels = DEFAULT_VOICE_SESSION_LABELS,
  className,
}: VoiceSessionConnectionAlertProps) {
  return (
    <div
      data-testid={VOICE_SESSION_TEST_IDS.RECOVERY_STATUS}
      role="alert"
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm sm:flex-row sm:items-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{labels.recoveryFailedTitle}</p>
        <p className="text-sm text-red-800">{labels.recoveryFailedDescription}</p>
      </div>
      <Button
        data-testid={VOICE_SESSION_TEST_IDS.RESTART_BUTTON}
        type="button"
        variant="primary"
        disabled={isRestarting}
        onClick={onRestart}
        className="h-9 shrink-0 gap-2 rounded-lg px-3"
      >
        <RefreshCw className={cn("size-4", isRestarting && "animate-spin")} />
        {labels.restart}
      </Button>
    </div>
  );
}

export type VoiceSessionTaskPanelProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labels?: Pick<VoiceSessionLabels, "task" | "close">;
};

export function VoiceSessionTaskPanel({
  open,
  onClose,
  children,
  labels = DEFAULT_VOICE_SESSION_LABELS,
}: VoiceSessionTaskPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          data-testid={VOICE_SESSION_TEST_IDS.TASK_PANEL}
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          transformTemplate={(_, generated) =>
            `translateY(var(--task-panel-offset-y)) ${generated}`
          }
          className="fixed bottom-0 left-0 right-0 top-auto z-50 flex max-h-[85dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-xl border-x-0 border-b-0 border-neutral-200 bg-background p-0 shadow-lg [--task-panel-offset-y:0px] md:bottom-auto md:left-auto md:right-4 md:top-1/2 md:max-h-[82vh] md:w-[28rem] md:max-w-[calc(100vw-2rem)] md:rounded-lg md:border md:[--task-panel-offset-y:-50%]"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
            <h3 className="text-lg font-semibold leading-none tracking-tight text-neutral-950">
              {labels.task}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label={labels.close}
              className="size-8 rounded-lg p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 py-5 text-left text-sm leading-relaxed text-neutral-800">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export type VoiceSessionControlsProps = {
  isMicMuted: boolean;
  onMicMutedChange: (muted: boolean) => void;
  onExit: () => void;
  onJudge?: () => void;
  canJudge?: boolean;
  isJudgePending?: boolean;
  onTaskToggle?: () => void;
  isTaskPanelOpen?: boolean;
  disabled?: boolean;
  labels?: VoiceSessionLabels;
  className?: string;
};

export function VoiceSessionControls({
  isMicMuted,
  onMicMutedChange,
  onExit,
  onJudge,
  canJudge = true,
  isJudgePending = false,
  onTaskToggle,
  isTaskPanelOpen = false,
  disabled = false,
  labels = DEFAULT_VOICE_SESSION_LABELS,
  className,
}: VoiceSessionControlsProps) {
  return (
    <div
      className={cn(
        "hidden shrink-0 flex-wrap items-center gap-2 sm:flex sm:justify-end",
        className,
      )}
    >
      {onTaskToggle && (
        <Button
          data-testid={VOICE_SESSION_TEST_IDS.TASK_BUTTON}
          type="button"
          variant="outline"
          onClick={onTaskToggle}
          className="h-10 min-w-28 gap-2 rounded-xl bg-white/85 px-4"
          aria-pressed={isTaskPanelOpen}
        >
          <BookOpen className="size-4" />
          {labels.task}
        </Button>
      )}
      {onJudge && (
        <Button
          data-testid={VOICE_SESSION_TEST_IDS.CHECK_BUTTON}
          type="button"
          variant="primary"
          onClick={onJudge}
          disabled={!canJudge || isJudgePending || disabled}
          className="h-10 min-w-28 gap-2 rounded-xl px-4"
        >
          <ClipboardCheck className="size-4" />
          {labels.check}
        </Button>
      )}
      <Button
        type="button"
        variant={isMicMuted ? "outline" : "primary"}
        aria-pressed={!isMicMuted}
        aria-label={isMicMuted ? labels.unmute : labels.mute}
        onClick={() => onMicMutedChange(!isMicMuted)}
        disabled={disabled}
        className={cn("h-10 min-w-28 gap-2 rounded-xl px-4", {
          "bg-white/85": isMicMuted,
        })}
      >
        {isMicMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        {isMicMuted ? labels.muted : labels.micOn}
      </Button>
      <Button
        data-testid={VOICE_SESSION_TEST_IDS.EXIT_BUTTON}
        type="button"
        variant="outline"
        onClick={onExit}
        className="h-10 min-w-28 gap-2 rounded-xl bg-white/85 px-4"
      >
        <X className="size-4" />
        {labels.exit}
      </Button>
    </div>
  );
}

export function VoiceSessionMobileControls({
  isMicMuted,
  onMicMutedChange,
  onExit,
  onJudge,
  canJudge = true,
  isJudgePending = false,
  onTaskToggle,
  isTaskPanelOpen = false,
  disabled = false,
  labels = DEFAULT_VOICE_SESSION_LABELS,
  className,
}: VoiceSessionControlsProps) {
  return (
    <div className={cn("fixed right-5 top-5 z-[60] flex items-center gap-2 sm:hidden", className)}>
      {onTaskToggle && (
        <Button
          data-testid={VOICE_SESSION_TEST_IDS.MOBILE_TASK_BUTTON}
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={isTaskPanelOpen}
          aria-label={labels.task}
          onClick={onTaskToggle}
          className={MOBILE_CONTROL_CLASS_NAME}
        >
          <BookOpen className="size-5" />
        </Button>
      )}
      {onJudge && (
        <Button
          data-testid={VOICE_SESSION_TEST_IDS.MOBILE_CHECK_BUTTON}
          type="button"
          variant="primary"
          size="icon"
          aria-label={labels.check}
          onClick={onJudge}
          disabled={!canJudge || isJudgePending || disabled}
          className={MOBILE_CHECK_CLASS_NAME}
        >
          <ClipboardCheck className="size-5" />
        </Button>
      )}
      <Button
        data-testid={VOICE_SESSION_TEST_IDS.MUTE_BUTTON}
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={!isMicMuted}
        aria-label={isMicMuted ? labels.unmute : labels.mute}
        onClick={() => onMicMutedChange(!isMicMuted)}
        disabled={disabled}
        className={MOBILE_CONTROL_CLASS_NAME}
      >
        {isMicMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </Button>
      <Button
        data-testid={VOICE_SESSION_TEST_IDS.MOBILE_EXIT_BUTTON}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={labels.exit}
        onClick={onExit}
        className={MOBILE_CONTROL_CLASS_NAME}
      >
        <X className="size-5" />
      </Button>
    </div>
  );
}
