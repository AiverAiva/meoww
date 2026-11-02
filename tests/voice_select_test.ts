import { MessageFlags } from "@discordeno/bot";
import { assertEquals } from "@std/assert";
import { MAX_AUDIO_BYTES, MAX_VOICE_SECS } from "../utils/voice/constants.ts";
import { selectVoiceAttachment } from "../utils/voice/select.ts";

const CDN = "https://cdn.discordapp.com/attachments/1/2/voice-message.ogg";

function voiceMessage(patch: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    flags: { contains: (bit: number) => bit === MessageFlags.IsVoiceMessage },
    attachments: [
      {
        filename: "voice-message.ogg",
        contentType: "audio/ogg; codecs=opus",
        size: 1200,
        url: CDN,
        duration_secs: 12.5,
        ...patch,
      },
    ],
    ...extra,
  };
}

Deno.test("selects one native voice attachment", () => {
  const selected = selectVoiceAttachment(voiceMessage());
  assertEquals(selected.ok, true);
  if (!selected.ok) return;
  assertEquals(selected.attachment.duration_secs, 12.5);
  assertEquals(selected.attachment.size, 1200);
  assertEquals(selected.attachment.filename, "voice-message.ogg");
  assertEquals(selected.attachment.url, CDN);
});

Deno.test("keeps a missing filename as an empty string", () => {
  const selected = selectVoiceAttachment(voiceMessage({ filename: 12 }));
  assertEquals(selected.ok, true);
  if (!selected.ok) return;
  assertEquals(selected.attachment.filename, "");
});

Deno.test("accepts the media CDN host and the exact caps", () => {
  const selected = selectVoiceAttachment(voiceMessage({
    url: "https://media.discordapp.net/attachments/1/2/voice-message.ogg",
    duration_secs: MAX_VOICE_SECS,
    size: MAX_AUDIO_BYTES,
    contentType: "audio/mpeg",
  }));
  assertEquals(selected.ok, true);
});

function reasonOf(message: Parameters<typeof selectVoiceAttachment>[0]): string {
  const selected = selectVoiceAttachment(message);
  if (selected.ok) throw new Error("expected the attachment to be rejected");
  return selected.reason;
}

Deno.test("rejects anything that is not one voice attachment", () => {
  assertEquals(reasonOf(undefined), "not_voice_message");
  assertEquals(reasonOf({ attachments: voiceMessage().attachments }), "not_voice_message");
  assertEquals(reasonOf(voiceMessage({}, { attachments: [] })), "not_voice_message");
  assertEquals(
    reasonOf({
      flags: voiceMessage().flags,
      attachments: [voiceMessage().attachments[0], voiceMessage().attachments[0]],
    }),
    "not_voice_message",
  );
  assertEquals(reasonOf(voiceMessage({ contentType: "image/png" })), "not_voice_message");
  assertEquals(
    reasonOf({
      flags: voiceMessage().flags,
      attachments: { length: 1 },
    }),
    "not_voice_message",
  );
});

Deno.test("rejects missing or unusable metadata", () => {
  for (const duration of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertEquals(reasonOf(voiceMessage({ duration_secs: duration })), "missing_metadata");
  }
  assertEquals(reasonOf(voiceMessage({ size: 0 })), "missing_metadata");
  assertEquals(reasonOf(voiceMessage({ size: Number.NaN })), "missing_metadata");
  assertEquals(
    reasonOf(voiceMessage({ url: "http://cdn.discordapp.com/attachments/1/2/a.ogg" })),
    "missing_metadata",
  );
  assertEquals(reasonOf(voiceMessage({ url: "https://evil.example/a.ogg" })), "missing_metadata");
  assertEquals(
    reasonOf(voiceMessage({ url: "https://cdn.discordapp.com.evil/a.ogg" })),
    "missing_metadata",
  );
});

Deno.test("rejects over-long and over-size voice messages before download", () => {
  const tooLong = selectVoiceAttachment(voiceMessage({ duration_secs: MAX_VOICE_SECS + 0.1 }));
  assertEquals(tooLong.ok, false);
  if (!tooLong.ok) assertEquals(tooLong.reason, "too_long");

  const tooLarge = selectVoiceAttachment(voiceMessage({ size: MAX_AUDIO_BYTES + 1 }));
  assertEquals(tooLarge.ok, false);
  if (!tooLarge.ok) {
    assertEquals(tooLarge.reason, "too_large");
    assertEquals(tooLarge.bytes, MAX_AUDIO_BYTES + 1);
  }
});
