import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import {
  VOICE_CONNECTION_STATE,
  type VoiceConnectionState,
  type VoiceModeState,
} from "../../core/constants";
import { cn } from "../../lib/utils";
import {
  VoiceConversationTranscript,
  type VoiceTranscriptMessage,
} from "../VoiceConversationTranscript";

import { resolveVoiceSessionLabels, type VoiceSessionLabelsInput } from "./labels";
import { VOICE_SESSION_TEST_IDS } from "./test-ids";
import {
  VoiceSessionConnectionAlert,
  VoiceSessionControls,
  VoiceSessionMobileControls,
  VoiceSessionStateTitle,
  VoiceSessionTaskPanel,
  VoiceSessionVisualizer,
} from "./VoiceSessionBlocks";

import type { LearnerTranscriptRevision, MentorSpeechPresentation } from "../../core/types";
import type { ReactNode } from "react";

export type VoiceMentorModeOverlayProps = {
  open: boolean;
  state: VoiceModeState;
  voiceLevel: number;
  mentorVoiceLevel: number;
  learnerTranscript: LearnerTranscriptRevision | null;
  response: string;
  mentorSpeech: MentorSpeechPresentation | null;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  learnerName: string;
  learnerAvatarUrl?: string | null;
  messages?: VoiceTranscriptMessage[];
  taskContent?: ReactNode;
  onJudge?: () => void;
  isJudgePending?: boolean;
  canJudge?: boolean;
  isMicMuted: boolean;
  connectionState: VoiceConnectionState;
  isRestarting?: boolean;
  onMicMutedChange: (muted: boolean) => void;
  onRestart: () => void;
  onExit: () => void;
  labels?: VoiceSessionLabelsInput;
  visualizerColor?: string;
  className?: string;
};

export function VoiceMentorModeOverlay({
  open,
  state,
  voiceLevel,
  mentorVoiceLevel,
  learnerTranscript,
  response,
  mentorSpeech,
  mentorName,
  mentorAvatarUrl,
  learnerName,
  learnerAvatarUrl,
  messages,
  taskContent,
  onJudge,
  isJudgePending = false,
  canJudge = true,
  isMicMuted,
  connectionState,
  isRestarting = false,
  onMicMutedChange,
  onRestart,
  onExit,
  labels: labelsInput,
  visualizerColor,
  className,
}: VoiceMentorModeOverlayProps) {
  const labels = useMemo(() => resolveVoiceSessionLabels(labelsInput), [labelsInput]);
  const hasTask = taskContent !== undefined && taskContent !== null && taskContent !== false;
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setIsTaskPanelOpen(hasTask);
    }
  }, [hasTask, open]);

  const isConnectionUnavailable = connectionState !== VOICE_CONNECTION_STATE.CONNECTED;
  const toggleTaskPanel = hasTask ? () => setIsTaskPanelOpen((isOpen) => !isOpen) : undefined;
  const controlProps = {
    isMicMuted,
    onMicMutedChange,
    onExit,
    onJudge,
    canJudge,
    isJudgePending,
    onTaskToggle: toggleTaskPanel,
    isTaskPanelOpen,
    disabled: isConnectionUnavailable,
    labels,
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="voice-mentor-overlay"
          data-testid={VOICE_SESSION_TEST_IDS.OVERLAY}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,var(--primary-100),transparent_52%),linear-gradient(180deg,var(--primary-50)_0%,#FFFFFF_100%)]",
            className,
          )}
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-6 md:px-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0 pr-56 sm:pr-0">
                <h2 className="truncate text-lg font-semibold text-neutral-900">{mentorName}</h2>
              </div>
              <VoiceSessionControls {...controlProps} />
            </div>

            {connectionState === VOICE_CONNECTION_STATE.FAILED && (
              <VoiceSessionConnectionAlert
                isRestarting={isRestarting}
                onRestart={onRestart}
                labels={labels}
              />
            )}

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
                <VoiceSessionStateTitle state={state} labels={labels} />

                <VoiceSessionVisualizer
                  state={state}
                  voiceLevel={voiceLevel}
                  mentorVoiceLevel={mentorVoiceLevel}
                  isMicMuted={isMicMuted}
                  color={visualizerColor}
                />

                <VoiceConversationTranscript
                  messages={messages}
                  learnerTranscript={learnerTranscript}
                  mentorResponse={response}
                  mentorSpeech={mentorSpeech}
                  mentorName={mentorName}
                  mentorAvatarUrl={mentorAvatarUrl}
                  learnerName={learnerName}
                  learnerAvatarUrl={learnerAvatarUrl}
                />
              </div>

              {hasTask && (
                <VoiceSessionTaskPanel
                  open={isTaskPanelOpen}
                  onClose={() => setIsTaskPanelOpen(false)}
                  labels={labels}
                >
                  {taskContent}
                </VoiceSessionTaskPanel>
              )}
            </div>
          </div>

          <VoiceSessionMobileControls {...controlProps} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
