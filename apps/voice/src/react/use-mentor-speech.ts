import { useCallback, useEffect, useRef, useState } from "react";

import {
  MentorSpeechController,
  type MentorAudioChunk,
  type MentorSpeechControllerOptions,
} from "../core/mentor-speech-controller";

import { useLatestRef } from "./use-latest-ref";

import type { MentorSpeechAlignment, MentorSpeechPresentation } from "../core/types";

export type UseMentorSpeechOptions = MentorSpeechControllerOptions;

export function useMentorSpeech(options: UseMentorSpeechOptions = {}) {
  const optionsRef = useLatestRef(options);
  const controllerRef = useRef<MentorSpeechController | null>(null);
  const [level, setLevel] = useState(0);
  const [presentation, setPresentation] = useState<MentorSpeechPresentation | null>(null);

  if (!controllerRef.current) {
    const initial = optionsRef.current;
    controllerRef.current = new MentorSpeechController({
      ...initial,
      onLevelChange: (nextLevel) => {
        setLevel(nextLevel);
        optionsRef.current.onLevelChange?.(nextLevel);
      },
      onPresentationChange: (next) => {
        setPresentation(next);
        optionsRef.current.onPresentationChange?.(next);
      },
      onTurnStarted: (turnId) => optionsRef.current.onTurnStarted?.(turnId),
      onTurnCompleted: (turnId) => optionsRef.current.onTurnCompleted?.(turnId),
      onInterrupted: () => optionsRef.current.onInterrupted?.(),
    });
  }

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      void controller?.destroy();
    };
  }, []);

  const start = useCallback(() => controllerRef.current!.start(), []);
  const pushAudio = useCallback(
    (chunk: MentorAudioChunk) => controllerRef.current!.pushAudio(chunk),
    [],
  );
  const pushAlignment = useCallback(
    (alignment: MentorSpeechAlignment) => controllerRef.current!.pushAlignment(alignment),
    [],
  );
  const completeTurn = useCallback(
    (turnId?: string) => controllerRef.current!.completeTurn(turnId),
    [],
  );
  const handleInterrupted = useCallback(
    (turnId?: string) => controllerRef.current!.handleInterrupted(turnId),
    [],
  );
  const interrupt = useCallback(() => controllerRef.current!.interrupt(), []);
  const reset = useCallback(() => controllerRef.current!.reset(), []);

  return {
    controller: controllerRef.current,
    level,
    presentation,
    start,
    pushAudio,
    pushAlignment,
    completeTurn,
    handleInterrupted,
    interrupt,
    reset,
  };
}
