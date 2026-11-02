import {
  NO_SPEECH_PROB_THRESHOLD,
  TRANSCRIPT_CHAR_BUDGET,
  VOICE_TITLE,
} from "./constants.ts";
import type { TranscriptResult } from "./types.ts";

const ELLIPSIS = "\n\n…(truncated)";

export function isEmptyTranscript(result: TranscriptResult): boolean {
  if (result.text.trim() === "") return true;
  return result.noSpeechProb !== undefined &&
    result.noSpeechProb >= NO_SPEECH_PROB_THRESHOLD;
}

export function formatDuration(secs: number): string {
  if (secs >= 60) {
    const total = Math.floor(secs);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  if (Number.isInteger(secs)) return `${secs}s`;
  const rounded = Math.round(secs * 10) / 10;
  return `${rounded}s`;
}

export function formatMeta(durationSecs: number, language?: string): string {
  const duration = formatDuration(durationSecs);
  if (!language) return duration;
  return `${duration} · detected ${language}`;
}

/** One Text Display: title, body, and meta, kept within the conservative budget. */
export function fitTranscriptBlock(body: string, meta: string): string {
  const head = `${VOICE_TITLE}\n`;
  const tail = `\n\n${meta}`;
  const full = `${head}${body}${tail}`;
  if (full.length <= TRANSCRIPT_CHAR_BUDGET) return full;
  const room = TRANSCRIPT_CHAR_BUDGET - head.length - tail.length - ELLIPSIS.length;
  const cut = room > 0 ? body.slice(0, room) : "";
  const fitted = `${head}${cut}${ELLIPSIS}${tail}`;
  if (fitted.length <= TRANSCRIPT_CHAR_BUDGET) return fitted;
  return fitted.slice(0, TRANSCRIPT_CHAR_BUDGET);
}
