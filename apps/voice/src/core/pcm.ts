const AUDIO_LEVEL_NOISE_FLOOR = 0.008;
const AUDIO_LEVEL_SCALE = 4;

export function float32ToPcm16(audio: Float32Array): Int16Array {
  const out = new Int16Array(audio.length);

  for (let i = 0; i < audio.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, audio[i]));
    out[i] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }

  return out;
}

export function pcm16leToFloat32(chunk: ArrayBuffer | Uint8Array): Float32Array {
  const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
  const totalSamples = Math.floor(bytes.length / 2);
  const out = new Float32Array(totalSamples);

  let byteOffset = 0;
  for (let i = 0; i < totalSamples; i += 1) {
    const lo = bytes[byteOffset] ?? 0;
    const hi = bytes[byteOffset + 1] ?? 0;
    const value = (hi << 8) | lo;
    const signed = value >= 0x8000 ? value - 0x10000 : value;

    out[i] = Math.max(-1, Math.min(1, signed / 32768));
    byteOffset += 2;
  }

  return out;
}

export function resampleLinear(
  audio: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audio;
  }

  const targetLength = Math.max(
    1,
    Math.round((audio.length * targetSampleRate) / sourceSampleRate),
  );
  const result = new Float32Array(targetLength);
  const ratio = sourceSampleRate / targetSampleRate;

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, audio.length - 1);
    const weight = sourceIndex - lowerIndex;
    result[index] = audio[lowerIndex] * (1 - weight) + audio[upperIndex] * weight;
  }

  return result;
}

export function calculateRms(audio: ArrayLike<number>): number {
  if (audio.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < audio.length; i += 1) {
    sum += audio[i] * audio[i];
  }

  return Math.sqrt(sum / audio.length);
}

export function calculateAudioLevel(audio: Float32Array): number {
  const rms = calculateRms(audio);
  const signal = Math.max(0, rms - AUDIO_LEVEL_NOISE_FLOOR);

  return Math.min(1, Math.sqrt(signal) * AUDIO_LEVEL_SCALE);
}

export function copyToArrayBuffer(samples: Int16Array): ArrayBuffer {
  const copy = new Int16Array(samples.length);
  copy.set(samples);
  return copy.buffer;
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  if (!base64) {
    return new Uint8Array(0);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
