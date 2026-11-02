import type { SpeechTranscriber, TranscriptResult } from "./types.ts";
import { isTimeoutError, VoiceError } from "./types.ts";

export interface LocalTranscriberOptions {
  url: string;
  model: string;
  fetchImpl?: typeof fetch;
}

function usableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function usableModel(model: string): boolean {
  return model.length > 0 && model.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(model);
}

function audioType(contentType: string): string {
  if (contentType.startsWith("audio/ogg")) return "audio/ogg";
  const base = contentType.split(";", 1)[0]?.trim() ?? "";
  if (/^audio\/[A-Za-z0-9.+-]+$/.test(base)) return base;
  return "application/octet-stream";
}

function fileName(name: string): string {
  const cleaned = name.replace(/[\r\n"]/g, "").trim();
  return cleaned || "voice-message.ogg";
}

export function noSpeechProbOf(segments: unknown): number | undefined {
  if (!Array.isArray(segments) || segments.length === 0) return undefined;
  let min = Infinity;
  for (const segment of segments) {
    if (typeof segment !== "object" || segment === null) return undefined;
    const value = (segment as { no_speech_prob?: unknown }).no_speech_prob;
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    if (value < min) min = value;
  }
  return min;
}

export function readTranscriptPayload(payload: unknown): TranscriptResult {
  if (typeof payload !== "object" || payload === null) {
    throw new VoiceError("stt_failed", { reason: "bad_json" });
  }
  const text = (payload as { text?: unknown }).text;
  if (typeof text !== "string") {
    throw new VoiceError("stt_failed", { reason: "bad_json" });
  }
  const language = (payload as { language?: unknown }).language;
  const noSpeechProb = noSpeechProbOf((payload as { segments?: unknown }).segments);
  return {
    text,
    language: typeof language === "string" && language.length > 0 ? language : undefined,
    noSpeechProb,
  };
}

export function createLocalTranscriber(options: LocalTranscriberOptions): SpeechTranscriber {
  const url = options.url.trim();
  const model = options.model.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async transcribe(audio, opts) {
      if (!usableUrl(url)) {
        throw new VoiceError("stt_unconfigured", { reason: "missing_url" });
      }
      if (!usableModel(model)) {
        throw new VoiceError("stt_unconfigured", { reason: "invalid_model" });
      }

      const form = new FormData();
      const bytes = new Uint8Array(audio);
      form.append("file", new Blob([bytes], { type: audioType(opts.contentType) }), fileName(opts.filename));
      form.append("model", model);
      form.append("response_format", "verbose_json");
      form.append("temperature", "0");

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          body: form,
          signal: opts.signal,
        });
      } catch (error) {
        throw new VoiceError("stt_failed", {
          reason: isTimeoutError(error) ? "timeout" : "network",
        });
      }

      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new VoiceError("stt_unauthorized", { status: response.status });
      }
      if (response.status === 429) {
        await response.body?.cancel();
        throw new VoiceError("stt_rate_limited", { status: 429 });
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new VoiceError("stt_failed", { status: response.status });
      }

      try {
        return readTranscriptPayload(await response.json());
      } catch (error) {
        if (error instanceof VoiceError) throw error;
        throw new VoiceError("stt_failed", { reason: "bad_json" });
      }
    },
  };
}
