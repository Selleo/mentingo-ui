import { useCallback, useEffect, useRef, useState } from "react";

import {
  VoiceCapture,
  type VoiceCaptureOptions,
  type VoiceCaptureStartOptions,
} from "../core/voice-capture";

import { useLatestRef } from "./use-latest-ref";

export type UseVoiceCaptureOptions = VoiceCaptureOptions;

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const optionsRef = useLatestRef(options);
  const captureRef = useRef<VoiceCapture | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [level, setLevel] = useState(0);

  if (!captureRef.current) {
    const initial = optionsRef.current;
    captureRef.current = new VoiceCapture({
      ...initial,
      onChunk: (chunk, meta) => optionsRef.current.onChunk?.(chunk, meta),
      onSpeechStart: (boundary) => optionsRef.current.onSpeechStart?.(boundary),
      onSpeechEnd: (boundary) => optionsRef.current.onSpeechEnd?.(boundary),
      onLevelChange: (nextLevel) => {
        setLevel(nextLevel);
        optionsRef.current.onLevelChange?.(nextLevel);
      },
    });
  }

  useEffect(() => {
    const capture = captureRef.current;
    return () => {
      void capture?.stop().catch(() => undefined);
    };
  }, []);

  const start = useCallback(async (startOptions?: VoiceCaptureStartOptions) => {
    const capture = captureRef.current;
    if (!capture || capture.isActive) return false;

    setIsStarting(true);
    try {
      await capture.start(startOptions);
      setIsActive(true);
      setIsMuted(false);
      return true;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    await captureRef.current?.stop();
    setIsActive(false);
    setIsMuted(false);
    setLevel(0);
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    const capture = captureRef.current;
    if (!capture?.isActive) return false;

    await capture.setMuted(muted);
    setIsMuted(muted);
    return true;
  }, []);

  const closeTurn = useCallback(() => captureRef.current?.closeTurn(), []);

  return {
    capture: captureRef.current,
    isActive,
    isStarting,
    isMuted,
    level,
    start,
    stop,
    setMuted,
    closeTurn,
  };
}
