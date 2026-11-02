export const MAX_VOICE_SECS = 600;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 15_000;
export const STT_TIMEOUT_MS = 45_000;
export const STT_CONCURRENCY = 2;
export const NO_SPEECH_PROB_THRESHOLD = 0.6;
export const TRANSCRIPT_CHAR_BUDGET = 3900;

export const CDN_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
]);

export const VOICE_TITLE = "### 🎙️ Voice Transcript";
export const TOO_LONG_TO_DISPLAY = "This transcript is too long to display.";
