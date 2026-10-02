import { MicVAD } from "@ricky0123/vad-web";

import { VOICE_ENDPOINTING_MODE, type VoiceEndpointingMode } from "./constants";
import {
  calculateAudioLevel,
  calculateRms,
  copyToArrayBuffer,
  float32ToPcm16,
  resampleLinear,
} from "./pcm";
import {
  advanceVadEndDeferral,
  beginVadEndDeferral,
  createVadEndDeferralState,
  shouldForwardVadEndFrame,
  VAD_END_DEFERRAL_PHASE,
  type VadEndDeferralState,
} from "./vad-end-deferral";

import type { PcmChunkMeta, PcmFormat, SpeechBoundary } from "./types";

export const VAD_WEB_VERSION = "0.0.30";
export const ONNX_RUNTIME_WEB_VERSION = "1.24.3";
export const DEFAULT_VAD_ASSET_BASE_PATH = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_WEB_VERSION}/dist/`;
export const DEFAULT_ONNX_WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;

export type SileroVadOptions = {
  positiveSpeechThreshold: number;
  negativeSpeechThreshold: number;
  minSpeechMs: number;
  redemptionMs: number;
  preSpeechPadMs: number;
  keepTurnOpenNegativeSpeechThreshold: number;
  keepTurnOpenRedemptionMs: number;
};

export const DEFAULT_SILERO_VAD_OPTIONS: SileroVadOptions = {
  positiveSpeechThreshold: 0.42,
  negativeSpeechThreshold: 0.24,
  minSpeechMs: 120,
  redemptionMs: 700,
  preSpeechPadMs: 500,
  keepTurnOpenNegativeSpeechThreshold: 0.18,
  keepTurnOpenRedemptionMs: 600,
};

export const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
};

export type VoiceCaptureOptions = {
  sampleRate?: number;
  chunkMs?: number;
  vad?: Partial<SileroVadOptions>;
  vadAssetBasePath?: string;
  onnxWasmBasePath?: string;
  audioConstraints?: MediaTrackConstraints;
  /** Mono PCM s16le chunk ready to send. In client VAD mode chunks are only produced during speech. */
  onChunk?: (chunk: ArrayBuffer, meta: PcmChunkMeta) => void;
  onSpeechStart?: (boundary: SpeechBoundary) => void;
  onSpeechEnd?: (boundary: SpeechBoundary) => void;
  onLevelChange?: (level: number) => void;
};

export type VoiceCaptureStartOptions = {
  endpointingMode?: VoiceEndpointingMode;
  /**
   * Keep one learner turn open across short pauses: boundaries are still emitted, but audio keeps
   * flowing until `closeTurn()` is called (typically when a final transcript arrives).
   */
  keepTurnOpen?: boolean;
  firstChunkSeq?: number;
};

export class VoiceCapture {
  private readonly targetSr: number;
  private readonly chunkSamples: number;
  private readonly channels = 1;
  private readonly vad: SileroVadOptions;
  private readonly preSpeechMaxSamples: number;
  private readonly options: VoiceCaptureOptions;

  private micVad: MicVAD | null = null;
  private continuousAudioContext: AudioContext | null = null;
  private continuousAudioStream: MediaStream | null = null;
  private continuousAudioSource: MediaStreamAudioSourceNode | null = null;
  private continuousAudioProcessor: ScriptProcessorNode | null = null;

  private active = false;
  private endpointingModeValue: VoiceEndpointingMode = VOICE_ENDPOINTING_MODE.CLIENT_VAD;
  private keepTurnOpen = false;
  private nextChunkSeq = 1;
  private firstSeqOfSession = 1;
  private speechBoundarySeq = 0;
  private pendingSamples: number[] = [];
  private preSpeechSamples: number[] = [];
  private isSpeaking = false;
  private hasActiveSpeechSegment = false;
  private vadEndDeferral: VadEndDeferralState = createVadEndDeferralState();
  private muted = false;
  private captureGeneration = 0;

  constructor(options: VoiceCaptureOptions = {}) {
    this.options = options;
    this.targetSr = options.sampleRate ?? 16000;
    this.chunkSamples = Math.round((this.targetSr * (options.chunkMs ?? 32)) / 1000);
    this.vad = { ...DEFAULT_SILERO_VAD_OPTIONS, ...options.vad };
    this.preSpeechMaxSamples = (this.targetSr * (this.vad.preSpeechPadMs + 120)) / 1000;
  }

  get format(): PcmFormat {
    return { sr: this.targetSr, channels: this.channels, format: "pcm_s16le" };
  }

  get isActive() {
    return this.active;
  }

  get isMuted() {
    return this.muted;
  }

  get endpointingMode() {
    return this.endpointingModeValue;
  }

  get lastChunkSeq() {
    return this.nextChunkSeq - 1 < this.firstSeqOfSession ? -1 : this.nextChunkSeq - 1;
  }

  async start(startOptions: VoiceCaptureStartOptions = {}) {
    if (this.active) {
      throw new Error("VOICE_CAPTURE_ALREADY_ACTIVE");
    }

    this.resetSessionState();
    this.captureGeneration += 1;
    this.endpointingModeValue = startOptions.endpointingMode ?? VOICE_ENDPOINTING_MODE.CLIENT_VAD;
    this.keepTurnOpen = startOptions.keepTurnOpen ?? false;
    this.nextChunkSeq = startOptions.firstChunkSeq ?? 1;
    this.firstSeqOfSession = this.nextChunkSeq;
    this.active = true;

    try {
      if (this.endpointingModeValue === VOICE_ENDPOINTING_MODE.PROVIDER) {
        await this.startContinuousCapture();
      } else {
        await this.ensureMicVad();
        await this.micVad?.start();
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    this.captureGeneration += 1;
    this.active = false;
    this.resetSessionState();
    this.keepTurnOpen = false;
    this.muted = false;
    this.endpointingModeValue = VOICE_ENDPOINTING_MODE.CLIENT_VAD;

    await this.destroyMicVad();
    await this.stopContinuousCapture();
  }

  closeTurn() {
    if (!this.keepTurnOpen) {
      return;
    }

    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
  }

  async setMuted(isMuted: boolean) {
    this.muted = isMuted;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
    this.options.onLevelChange?.(0);

    if (this.endpointingModeValue === VOICE_ENDPOINTING_MODE.PROVIDER) {
      return;
    }

    if (!this.micVad) {
      return;
    }

    if (isMuted) {
      await this.micVad.pause?.().catch(() => undefined);
      return;
    }

    await this.micVad.start?.().catch(() => undefined);
  }

  private resetSessionState() {
    this.speechBoundarySeq = 0;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
  }

  private async ensureMicVad(): Promise<void> {
    if (this.micVad) {
      return;
    }

    const captureGeneration = this.captureGeneration;
    const micVad = await MicVAD.new({
      model: "v5",
      startOnLoad: false,
      submitUserSpeechOnPause: true,
      positiveSpeechThreshold: this.vad.positiveSpeechThreshold,
      negativeSpeechThreshold: this.keepTurnOpen
        ? this.vad.keepTurnOpenNegativeSpeechThreshold
        : this.vad.negativeSpeechThreshold,
      minSpeechMs: this.vad.minSpeechMs,
      redemptionMs: this.keepTurnOpen ? this.vad.keepTurnOpenRedemptionMs : this.vad.redemptionMs,
      preSpeechPadMs: this.vad.preSpeechPadMs,
      baseAssetPath: this.options.vadAssetBasePath ?? DEFAULT_VAD_ASSET_BASE_PATH,
      onnxWASMBasePath: this.options.onnxWasmBasePath ?? DEFAULT_ONNX_WASM_BASE_PATH,
      getStream: async () => {
        return await navigator.mediaDevices.getUserMedia({
          audio: this.options.audioConstraints ?? DEFAULT_AUDIO_CONSTRAINTS,
          video: false,
        });
      },
      onFrameProcessed: (probabilities, frame) => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        const level = Number(probabilities.isSpeech) || 0;
        this.options.onLevelChange?.(this.muted ? 0 : Math.max(0, Math.min(1, level)));

        if (this.muted) {
          this.pendingSamples = [];
          this.preSpeechSamples = [];
          this.vadEndDeferral = createVadEndDeferralState();
          return;
        }

        const pcm16Frame = float32ToPcm16(frame);

        if (this.keepTurnOpen) {
          if (!this.hasActiveSpeechSegment) {
            this.appendPreSpeechSamples(pcm16Frame);
            return;
          }

          if (pcm16Frame.length > 0) {
            this.pendingSamples.push(...pcm16Frame);
            this.emitReadyChunks();
          }
          return;
        }

        if (!this.isSpeaking && pcm16Frame.length > 0) {
          this.appendPreSpeechSamples(pcm16Frame);
        }

        if (!this.isSpeaking) {
          return;
        }

        const frameRms = calculateRms(frame);
        const isDeferringEnd = this.vadEndDeferral.phase === VAD_END_DEFERRAL_PHASE.PENDING;
        if (pcm16Frame.length > 0 && (!isDeferringEnd || shouldForwardVadEndFrame(frameRms))) {
          this.pendingSamples.push(...pcm16Frame);
          this.emitReadyChunks();
        }

        this.advanceDeferredSpeechEnd(frameRms, frame.length);
      },
      onSpeechStart: () => undefined,
      onSpeechRealStart: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingModeValue === VOICE_ENDPOINTING_MODE.PROVIDER || this.muted) {
          return;
        }

        if (this.keepTurnOpen) {
          if (this.isSpeaking) {
            return;
          }

          this.isSpeaking = true;
          this.emitSpeechStartBoundary();

          if (!this.hasActiveSpeechSegment) {
            this.hasActiveSpeechSegment = true;
            this.flushPreSpeechSamples();
          }
          return;
        }

        if (this.hasActiveSpeechSegment) {
          this.vadEndDeferral = createVadEndDeferralState();
          this.isSpeaking = true;
          return;
        }

        this.vadEndDeferral = createVadEndDeferralState();
        this.isSpeaking = true;
        this.hasActiveSpeechSegment = true;
        this.emitSpeechStartBoundary();
        this.flushPreSpeechSamples();
      },
      onSpeechEnd: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingModeValue === VOICE_ENDPOINTING_MODE.PROVIDER) {
          return;
        }

        if (this.muted || !this.hasActiveSpeechSegment) {
          return;
        }

        if (this.keepTurnOpen) {
          if (!this.isSpeaking) {
            return;
          }

          this.isSpeaking = false;
          this.emitSpeechEndBoundary();
          return;
        }

        this.preSpeechSamples = [];
        this.vadEndDeferral = beginVadEndDeferral(this.vadEndDeferral);
      },
      onVADMisfire: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingModeValue === VOICE_ENDPOINTING_MODE.PROVIDER) {
          return;
        }

        if (this.keepTurnOpen) {
          return;
        }

        if (this.hasActiveSpeechSegment) {
          this.vadEndDeferral = beginVadEndDeferral(this.vadEndDeferral);
          return;
        }

        this.isSpeaking = false;
        this.pendingSamples = [];
        this.preSpeechSamples = [];
        this.hasActiveSpeechSegment = false;
        this.vadEndDeferral = createVadEndDeferralState();
      },
    });

    // The session was stopped while the model was loading.
    if (captureGeneration !== this.captureGeneration) {
      await micVad.destroy().catch(() => undefined);
      return;
    }

    this.micVad = micVad;
  }

  private async destroyMicVad() {
    const micVad = this.micVad;
    this.micVad = null;
    await micVad?.destroy().catch(() => undefined);
  }

  private flushPreSpeechSamples() {
    if (this.preSpeechSamples.length === 0) {
      return;
    }

    this.pendingSamples.push(...this.preSpeechSamples);
    this.preSpeechSamples = [];
    this.emitReadyChunks();
  }

  private emitReadyChunks() {
    if (!this.active) {
      return;
    }

    while (this.pendingSamples.length >= this.chunkSamples) {
      this.emitChunk(this.pendingSamples.splice(0, this.chunkSamples));
    }
  }

  private emitChunk(samples: number[]) {
    if (!this.active || samples.length === 0) {
      return;
    }

    const chunkBuffer = copyToArrayBuffer(Int16Array.from(samples));
    const meta: PcmChunkMeta = {
      seq: this.nextChunkSeq++,
      sr: this.targetSr,
      samples: samples.length,
      ts_ms: performance.now(),
    };

    this.options.onChunk?.(chunkBuffer, meta);
  }

  private appendPreSpeechSamples(samples: Int16Array) {
    if (samples.length === 0) {
      return;
    }

    this.preSpeechSamples.push(...samples);
    if (this.preSpeechSamples.length > this.preSpeechMaxSamples) {
      this.preSpeechSamples.splice(0, this.preSpeechSamples.length - this.preSpeechMaxSamples);
    }
  }

  private createBoundary(): SpeechBoundary {
    return {
      boundarySeq: ++this.speechBoundarySeq,
      tsMs: performance.now(),
      lastChunkSeq: this.lastChunkSeq,
    };
  }

  private emitSpeechStartBoundary() {
    this.options.onSpeechStart?.(this.createBoundary());
  }

  private emitSpeechEndBoundary() {
    if (!this.hasActiveSpeechSegment) {
      this.pendingSamples = [];
      return;
    }

    this.emitReadyChunks();
    this.emitChunk(this.pendingSamples.splice(0));
    this.options.onSpeechEnd?.(this.createBoundary());
  }

  private advanceDeferredSpeechEnd(frameRms: number, frameSamples: number) {
    const result = advanceVadEndDeferral(
      this.vadEndDeferral,
      frameRms,
      (frameSamples / this.targetSr) * 1000,
    );
    this.vadEndDeferral = result.state;

    if (result.shouldFinalize) {
      this.completeActiveSpeechSegment();
    }
  }

  private completeActiveSpeechSegment() {
    if (!this.hasActiveSpeechSegment) {
      return;
    }

    this.isSpeaking = false;
    this.preSpeechSamples = [];
    this.emitSpeechEndBoundary();
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
  }

  private async startContinuousCapture() {
    if (this.continuousAudioContext) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: this.options.audioConstraints ?? DEFAULT_AUDIO_CONSTRAINTS,
      video: false,
    });
    const audioContext = new AudioContext({ sampleRate: this.targetSr });
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (this.muted) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const frame = resampleLinear(input, event.inputBuffer.sampleRate, this.targetSr);
      this.options.onLevelChange?.(calculateAudioLevel(frame));
      this.pendingSamples.push(...float32ToPcm16(frame));
      this.emitReadyChunks();
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    this.continuousAudioContext = audioContext;
    this.continuousAudioStream = stream;
    this.continuousAudioSource = source;
    this.continuousAudioProcessor = processor;
  }

  private async stopContinuousCapture() {
    this.continuousAudioProcessor?.disconnect();
    this.continuousAudioSource?.disconnect();
    this.continuousAudioStream?.getTracks().forEach((track) => track.stop());

    if (this.continuousAudioContext && this.continuousAudioContext.state !== "closed") {
      await this.continuousAudioContext.close().catch(() => undefined);
    }

    this.continuousAudioProcessor = null;
    this.continuousAudioSource = null;
    this.continuousAudioStream = null;
    this.continuousAudioContext = null;
  }

  private isCaptureGenerationActive(captureGeneration: number) {
    return this.active && captureGeneration === this.captureGeneration;
  }
}
