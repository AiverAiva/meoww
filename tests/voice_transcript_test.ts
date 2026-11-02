import { assertEquals } from "@std/assert";
import { TRANSCRIPT_CHAR_BUDGET, VOICE_TITLE } from "../utils/voice/constants.ts";
import {
  fitTranscriptBlock,
  formatDuration,
  formatMeta,
  isEmptyTranscript,
} from "../utils/voice/transcript.ts";

Deno.test("treats blank text and a high no-speech probability as empty", () => {
  assertEquals(isEmptyTranscript({ text: "  \n" }), true);
  assertEquals(isEmptyTranscript({ text: "hello", noSpeechProb: 0.6 }), true);
  assertEquals(isEmptyTranscript({ text: "hello", noSpeechProb: 0.59 }), false);
  assertEquals(isEmptyTranscript({ text: "hello" }), false);
});

Deno.test("formats durations below a minute in seconds and longer ones as m:ss", () => {
  assertEquals(formatDuration(12), "12s");
  assertEquals(formatDuration(12.5), "12.5s");
  assertEquals(formatDuration(12.54), "12.5s");
  assertEquals(formatDuration(60), "1:00");
  assertEquals(formatDuration(72.9), "1:12");
  assertEquals(formatMeta(12.5, "zh"), "12.5s · detected zh");
  assertEquals(formatMeta(12.5), "12.5s");
});

Deno.test("keeps the transcript block inside the display budget", () => {
  const meta = "12.5s · detected zh";
  const short = fitTranscriptBlock("hello", meta);
  assertEquals(short, `${VOICE_TITLE}\nhello\n\n${meta}`);
  assertEquals(short.length <= TRANSCRIPT_CHAR_BUDGET, true);

  const long = fitTranscriptBlock("字".repeat(5000), meta);
  assertEquals(long.includes("…(truncated)"), true);
  assertEquals(long.startsWith(VOICE_TITLE), true);
  assertEquals(long.endsWith(meta), true);
  assertEquals(long.length <= TRANSCRIPT_CHAR_BUDGET, true);

  const hugeMeta = "m".repeat(TRANSCRIPT_CHAR_BUDGET + 50);
  assertEquals(fitTranscriptBlock("hello", hugeMeta).length, TRANSCRIPT_CHAR_BUDGET);
});
