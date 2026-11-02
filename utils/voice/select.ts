import { MessageFlags } from "@discordeno/bot";
import { CDN_HOSTS, MAX_AUDIO_BYTES, MAX_VOICE_SECS } from "./constants.ts";
import type { VoiceFailureCode } from "./types.ts";

export interface SelectedVoiceAttachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
  duration_secs: number;
}

export type SelectResult =
  | { ok: true; attachment: SelectedVoiceAttachment }
  | {
    ok: false;
    reason: Extract<
      VoiceFailureCode,
      "not_voice_message" | "missing_metadata" | "too_long" | "too_large"
    >;
    durationSecs?: number;
    bytes?: number;
  };

export function parseDiscordCdnUrl(url: string): URL | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") return undefined;
  if (!CDN_HOSTS.has(parsed.hostname)) return undefined;
  return parsed;
}

interface LooseAttachment {
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
  url?: unknown;
  duration_secs?: unknown;
}

interface LooseMessage {
  flags?: { contains?: (bit: number) => boolean };
  attachments?: unknown;
}

export function selectVoiceAttachment(message: LooseMessage | undefined): SelectResult {
  const attachments = message?.attachments;
  const flagged = message?.flags?.contains?.(MessageFlags.IsVoiceMessage) === true;
  if (!flagged || !Array.isArray(attachments) || attachments.length !== 1) {
    return { ok: false, reason: "not_voice_message" };
  }

  const attachment = attachments[0] as LooseAttachment;
  const contentType = attachment?.contentType;
  if (typeof contentType !== "string" || !contentType.startsWith("audio/")) {
    return { ok: false, reason: "not_voice_message" };
  }

  const duration = attachment.duration_secs;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return { ok: false, reason: "missing_metadata" };
  }
  if (duration > MAX_VOICE_SECS) {
    return { ok: false, reason: "too_long", durationSecs: duration };
  }

  const size = attachment.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: "missing_metadata" };
  }
  if (size > MAX_AUDIO_BYTES) {
    return { ok: false, reason: "too_large", bytes: size };
  }

  const url = attachment.url;
  if (typeof url !== "string" || !parseDiscordCdnUrl(url)) {
    return { ok: false, reason: "missing_metadata" };
  }

  const filename = typeof attachment.filename === "string" ? attachment.filename : "";
  return {
    ok: true,
    attachment: { filename, contentType, size, url, duration_secs: duration },
  };
}
