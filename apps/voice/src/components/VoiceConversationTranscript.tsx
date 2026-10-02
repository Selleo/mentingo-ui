import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LEARNER_TRANSCRIPT_STATUSES } from "../core/constants";
import { cn } from "../lib/utils";

import { LearnerAvatar, MentorAvatar } from "./VoiceAvatar";

import type { LearnerTranscriptRevision, MentorSpeechPresentation } from "../core/types";

export const VOICE_TRANSCRIPT_ROLE = {
  LEARNER: "learner",
  MENTOR: "mentor",
} as const;

export type VoiceTranscriptRole =
  (typeof VOICE_TRANSCRIPT_ROLE)[keyof typeof VOICE_TRANSCRIPT_ROLE];

export type VoiceTranscriptMessage = {
  id: string;
  role: VoiceTranscriptRole;
  text: string;
};

export type VoiceConversationTranscriptProps = {
  learnerTranscript: LearnerTranscriptRevision | null;
  mentorResponse: string;
  mentorSpeech: MentorSpeechPresentation | null;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  learnerName: string;
  learnerAvatarUrl?: string | null;
  messages?: VoiceTranscriptMessage[];
  className?: string;
};

type TranscriptRow = {
  id: string;
  role: VoiceTranscriptRole;
  text: string;
  learner: LearnerTranscriptRevision | null;
};

function getDisplaySegments(text: string, words: MentorSpeechPresentation["words"]) {
  const segments: Array<{ text: string; wordIndex: number | null; offset: number }> = [];
  let cursor = 0;
  for (const [wordIndex, word] of words.entries()) {
    if (!word.text) continue;
    const start = text.indexOf(word.text, cursor);
    if (start < 0) break;
    const end = start + word.text.length;
    // Never highlight a coincidental substring of a word or decimal expression.
    const before = text.slice(Math.max(0, start - 2), start);
    const after = text.slice(end, end + 2);
    if (
      (/^[\p{L}\p{N}_]/u.test(word.text) && /[\p{L}\p{N}_]$|\d[.,]$/u.test(before)) ||
      (/[\p{L}\p{N}_]$/u.test(word.text) && /^[\p{L}\p{N}_]|^[.,]\d/u.test(after))
    )
      break;
    if (start > cursor)
      segments.push({ text: text.slice(cursor, start), wordIndex: null, offset: cursor });
    segments.push({ text: text.slice(start, end), wordIndex, offset: start });
    cursor = end;
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), wordIndex: null, offset: cursor });
  return segments;
}

function MentorTimedText({ speech, text }: { speech: MentorSpeechPresentation; text: string }) {
  const segments = useMemo(() => getDisplaySegments(text, speech.words), [text, speech.words]);
  return (
    <span aria-hidden="true" className="whitespace-pre-wrap">
      {segments.map((segment) => (
        <span
          key={segment.offset}
          className={cn("rounded py-0.5", {
            "bg-primary-100 text-primary-950":
              segment.wordIndex !== null && segment.wordIndex === speech.activeWordIndex,
          })}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}

function TranscriptMessages({
  learnerTranscript,
  mentorResponse,
  mentorSpeech,
  mentorName,
  mentorAvatarUrl,
  learnerName,
  learnerAvatarUrl,
  animateFinalization = false,
  onFinalizationEnd,
}: VoiceConversationTranscriptProps & {
  animateFinalization?: boolean;
  onFinalizationEnd?: () => void;
}) {
  const isLearnerPartial = learnerTranscript?.status === LEARNER_TRANSCRIPT_STATUSES.PARTIAL;
  const hasMentorSpeech = Boolean(mentorSpeech?.words.length);

  if (!learnerTranscript && !mentorResponse) {
    return <div className="h-24" aria-hidden="true" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col justify-end gap-3">
      {learnerTranscript && (
        <div className="flex max-w-[88%] self-start items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <LearnerAvatar name={learnerName} imageUrl={learnerAvatarUrl} />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary-900">{learnerName}</span>
            <div
              aria-live={isLearnerPartial ? "polite" : "off"}
              className={cn(
                "w-fit max-w-full rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed",
                {
                  "border border-neutral-200 bg-white/70 text-neutral-400": isLearnerPartial,
                  "border border-neutral-200 bg-white/90 text-neutral-900 shadow-sm":
                    !isLearnerPartial,
                },
              )}
            >
              <span
                className={cn(
                  animateFinalization && !isLearnerPartial && "transcript-finalized-text",
                )}
                onAnimationEnd={onFinalizationEnd}
              >
                {learnerTranscript.text}
              </span>
            </div>
          </div>
        </div>
      )}

      {mentorResponse && (
        <div className="flex max-w-[88%] items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <MentorAvatar name={mentorName} imageUrl={mentorAvatarUrl} />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary-900">{mentorName}</span>
            <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200/80">
              {hasMentorSpeech && mentorSpeech ? (
                <>
                  <span className="sr-only">{mentorResponse}</span>
                  <MentorTimedText speech={mentorSpeech} text={mentorResponse} />
                </>
              ) : (
                mentorResponse
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VoiceConversationTranscript(props: VoiceConversationTranscriptProps) {
  const { messages, mentorResponse, learnerTranscript, className } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const committedLearnerTurnsRef = useRef(new Set<string>());
  const previousTranscriptRef = useRef(learnerTranscript);
  const [finalizingTurnId, setFinalizingTurnId] = useState<string | null>(null);
  const [fade, setFade] = useState(0);
  useLayoutEffect(() => {
    const previous = previousTranscriptRef.current;
    previousTranscriptRef.current = learnerTranscript;
    if (
      learnerTranscript?.status === LEARNER_TRANSCRIPT_STATUSES.FINAL &&
      (previous?.turnId !== learnerTranscript.turnId ||
        previous.status !== LEARNER_TRANSCRIPT_STATUSES.FINAL) &&
      !committedLearnerTurnsRef.current.has(learnerTranscript.turnId)
    ) {
      setFinalizingTurnId(learnerTranscript.turnId);
    }
  }, [learnerTranscript]);
  const recentMessages = useMemo(() => {
    if (!messages) return undefined;
    const result: TranscriptRow[] = messages
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        learner:
          message.role === VOICE_TRANSCRIPT_ROLE.LEARNER
            ? {
                turnId: message.id,
                segmentId: message.id,
                revision: 0,
                status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
                text: message.text,
              }
            : null,
      }))
      .filter((message) => message.text.trim());
    if (
      learnerTranscript?.text.trim() &&
      !committedLearnerTurnsRef.current.has(learnerTranscript.turnId) &&
      !result.some((message) => message.id === learnerTranscript.turnId)
    ) {
      result.push({
        id: learnerTranscript.turnId,
        role: VOICE_TRANSCRIPT_ROLE.LEARNER,
        text: learnerTranscript.text,
        learner: learnerTranscript,
      });
    }
    return result.slice(-12);
  }, [messages, learnerTranscript]);
  useLayoutEffect(() => {
    if (
      learnerTranscript?.status === LEARNER_TRANSCRIPT_STATUSES.FINAL &&
      messages?.some(
        (message) =>
          message.role === VOICE_TRANSCRIPT_ROLE.LEARNER && message.id === learnerTranscript.turnId,
      )
    ) {
      committedLearnerTurnsRef.current.add(learnerTranscript.turnId);
    }
  }, [messages, learnerTranscript]);
  const measureScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    previousScrollTopRef.current = viewport.scrollTop;
    setFade(Math.min(Math.max(viewport.scrollTop, 0) / 24, 1));
  }, []);
  const followLatest = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport && followRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    measureScroll();
  }, [measureScroll]);

  useLayoutEffect(followLatest, [
    recentMessages,
    mentorResponse,
    props.learnerTranscript,
    followLatest,
  ]);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(followLatest);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [followLatest]);

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label={props.mentorName}
      // The scroll viewport must support keyboard navigation.
      tabIndex={0}
      onScroll={(event) => {
        const viewport = event.currentTarget;
        if (viewport.scrollTop < previousScrollTopRef.current) followRef.current = false;
        if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 8) {
          followRef.current = true;
        }
        measureScroll();
      }}
      className={cn(
        "mx-auto min-h-24 max-h-[clamp(8rem,28dvh,18rem)] w-full max-w-3xl shrink-0 overflow-y-auto overscroll-contain scroll-auto rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400",
        className,
      )}
      style={{ maskImage: `linear-gradient(to bottom, rgba(0,0,0,${1 - fade}), black 24px)` }}
    >
      <div ref={contentRef} className="flex flex-col gap-3 px-1 py-1">
        {recentMessages ? (
          recentMessages.map((message, index) => (
            <TranscriptMessages
              key={message.id}
              {...props}
              animateFinalization={message.id === finalizingTurnId}
              onFinalizationEnd={() => setFinalizingTurnId(null)}
              learnerTranscript={message.learner}
              mentorResponse={message.role === VOICE_TRANSCRIPT_ROLE.MENTOR ? message.text : ""}
              mentorSpeech={
                index === recentMessages.length - 1 && message.text.trim() === mentorResponse.trim()
                  ? props.mentorSpeech
                  : null
              }
            />
          ))
        ) : (
          <TranscriptMessages
            {...props}
            animateFinalization={Boolean(
              finalizingTurnId && finalizingTurnId === learnerTranscript?.turnId,
            )}
            onFinalizationEnd={() => setFinalizingTurnId(null)}
          />
        )}
      </div>
    </div>
  );
}
