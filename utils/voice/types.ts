export type VoiceFailureCode =
  | "not_voice_message"
  | "missing_metadata"
  | "too_long"
  | "too_large"
  | "download_failed"
  | "busy"
  | "stt_unconfigured"
  | "stt_unauthorized"
  | "stt_rate_limited"
  | "stt_failed"
  | "stt_empty"
  | "convert_failed";

export class VoiceError extends Error {
  readonly code: VoiceFailureCode;
  readonly status?: number;
  readonly reason?: string;
  readonly bytes?: number;

  constructor(
    code: VoiceFailureCode,
    options?: { status?: number; reason?: string; bytes?: number },
  ) {
    super(code);
    this.name = "VoiceError";
    this.code = code;
    this.status = options?.status;
    this.reason = options?.reason;
    this.bytes = options?.bytes;
  }
}

export interface TranscriptResult {
  text: string;
  /** ISO-639-1 from the provider, e.g. "zh" or "en". Absent when the server omits it. */
  language?: string;
  /**
   * Set only when `segments` is a non-empty array and every segment has a
   * numeric `no_speech_prob`. Value is the minimum of those probabilities.
   */
  noSpeechProb?: number;
}

export interface SpeechTranscriber {
  transcribe(
    audio: Uint8Array,
    opts: {
      filename: string;
      contentType: string;
      signal: AbortSignal;
    },
  ): Promise<TranscriptResult>;
}

export function statusOf(error: unknown): number | undefined {
  if (error instanceof VoiceError) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError");
}

export function outcomeOf(error: VoiceError): string {
  switch (error.code) {
    case "not_voice_message":
    case "missing_metadata":
    case "too_long":
    case "too_large":
      return "rejected";
    default:
      return error.code;
  }
}

export function userText(code: VoiceFailureCode): string {
  switch (code) {
    case "not_voice_message":
    case "missing_metadata":
      return "This message is not a Discord voice message.";
    case "too_long":
      return "This voice message is longer than 10 minutes.";
    case "too_large":
      return "This voice message is too large to transcribe.";
    case "download_failed":
      return "Couldn't download the voice message.";
    case "busy":
    case "stt_rate_limited":
      return "Voice transcription is busy. Try again in a moment.";
    case "stt_unconfigured":
    case "stt_unauthorized":
    case "stt_failed":
      return "Couldn't transcribe this voice message. Try again later.";
    case "stt_empty":
      return "No speech was detected in this voice message.";
    case "convert_failed":
      return "Couldn't convert this transcript to Traditional Chinese.";
    default: {
      const neverCode: never = code;
      return neverCode;
    }
  }
}

export function asVoiceError(error: unknown): VoiceError {
  if (error instanceof VoiceError) return error;
  return new VoiceError("stt_failed", {
    reason: isTimeoutError(error) ? "timeout" : "unknown",
  });
}
