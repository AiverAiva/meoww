import { InteractionResponseTypes, MessageFlags } from "@discordeno/bot";
import { assert, assertEquals, assertRejects } from "@std/assert";
import type { AnyBot } from "../types.ts";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { UI_COLORS } from "../utils/ui_factory.ts";
import { maybeConvert } from "../utils/voice/convert.ts";
import { createConcurrencyLimiter } from "../utils/voice/limit.ts";
import { runVoicePreview } from "../commands/voice_preview.ts";
import { TOO_LONG_TO_DISPLAY } from "../utils/voice/constants.ts";
import { VoiceError, type SpeechTranscriber, type TranscriptResult } from "../utils/voice/types.ts";

const CDN = "https://cdn.discordapp.com/attachments/1/2/voice-message.ogg";

interface Call {
  kind: "send" | "edit";
  body: {
    type?: number;
    data?: Record<string, unknown>;
    flags?: number;
    allowedMentions?: { parse: string[] };
    components?: unknown;
  };
}

function voiceInteraction(duration = 12.5) {
  const message = {
    id: "99",
    flags: { contains: (bit: number) => bit === MessageFlags.IsVoiceMessage },
    attachments: [
      {
        filename: "voice-message.ogg",
        contentType: "audio/ogg",
        size: 1000,
        url: CDN,
        duration_secs: duration,
      },
    ],
  };
  return {
    id: "interaction",
    token: "token",
    data: {
      resolved: {
        messages: { values: () => [message].values() },
      },
    },
  };
}

function fakeBot(edit?: (body: Record<string, unknown>) => void) {
  const calls: Call[] = [];
  const bot = {
    helpers: {
      sendInteractionResponse(_id: string, _token: string, body: Call["body"]) {
        calls.push({ kind: "send", body });
        return Promise.resolve();
      },
      editOriginalInteractionResponse(_token: string, body: Record<string, unknown>) {
        calls.push({ kind: "edit", body });
        edit?.(body);
        return Promise.resolve();
      },
    },
  };
  return { bot: bot as unknown as AnyBot, calls };
}

function textOf(call: Call | undefined): string {
  return JSON.stringify(call?.body ?? {});
}

function deps(overrides: {
  limiter?: ReturnType<typeof createConcurrencyLimiter>;
  transcribe?: SpeechTranscriber["transcribe"];
  download?: () => Promise<Uint8Array>;
  convert?: (text: string, language?: string) => string;
} = {}) {
  const seen: Record<string, unknown>[] = [];
  return {
    seen,
    limiter: overrides.limiter ?? createConcurrencyLimiter(2),
    transcriber: {
      transcribe: overrides.transcribe ?? ((async (_audio, opts) => {
        seen.push(opts as unknown as Record<string, unknown>);
        return { text: "hello @everyone <@1>", language: "en" } satisfies TranscriptResult;
      }) as SpeechTranscriber["transcribe"]),
    },
    download: overrides.download ?? (() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    convert: overrides.convert ?? ((text: string) => text),
  };
}

Deno.test("rejects a non-voice message before deferring or taking a slot", async () => {
  const { bot, calls } = fakeBot();
  let acquired = 0;
  await runVoicePreview(bot, { id: "i", token: "t", data: {} }, deps({
    limiter: {
      tryAcquire() {
        acquired += 1;
        return { release() {} };
      },
    },
  }));
  assertEquals(acquired, 0);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].body.type, InteractionResponseTypes.ChannelMessageWithSource);
  assertEquals(calls[0].body.data?.flags, IS_COMPONENTS_V2);
  assertEquals((calls[0].body.data?.flags as number) & (1 << 6), 0);
  assertEquals(calls[0].body.data?.allowedMentions, { parse: [] });
  assert(textOf(calls[0]).includes("This message is not a Discord voice message."));
});

Deno.test("rejects an over-long voice message before deferring", async () => {
  const { bot, calls } = fakeBot();
  await runVoicePreview(bot, voiceInteraction(601), deps());
  assertEquals(calls.length, 1);
  assertEquals(calls[0].body.type, InteractionResponseTypes.ChannelMessageWithSource);
  assert(textOf(calls[0]).includes("This voice message is longer than 10 minutes."));
});

Deno.test("defers in public and posts one transcript card", async () => {
  const { bot, calls } = fakeBot();
  const used = deps();
  await runVoicePreview(bot, voiceInteraction(), used);
  assertEquals(calls[0].body, {
    type: InteractionResponseTypes.DeferredChannelMessageWithSource,
    data: {},
  });
  assertEquals(calls.length, 2);
  const edit = calls[1].body;
  assertEquals(edit.flags, IS_COMPONENTS_V2);
  assertEquals(edit.allowedMentions, { parse: [] });
  const card = (edit.components as { accent_color: number; components: { content: string }[] }[])[0];
  assertEquals(card.accent_color, UI_COLORS.INFO);
  assert(card.components[0].content.includes("### 🎙️ Voice Transcript"));
  assert(card.components[0].content.includes("@\u200beveryone"));
  assertEquals(card.components[0].content.includes("@everyone"), false);
  assert(card.components[0].content.includes("<\u200b@1>"));
  assert(card.components[0].content.includes("12.5s · detected en"));
  assertEquals("language" in used.seen[0], false);
  assertEquals(typeof used.seen[0].signal, "object");
});

Deno.test("converts a zh transcript before showing it", async () => {
  const { bot, calls } = fakeBot();
  await runVoicePreview(bot, voiceInteraction(), deps({
    transcribe: async () => ({ text: "软件", language: "zh" }),
    convert: maybeConvert,
  }));
  const content = textOf(calls[1]);
  assert(content.includes("軟體"));
  assertEquals(content.includes("软件"), false);
  assert(content.includes("detected zh"));
});

Deno.test("tells the channel the transcriber is busy", async () => {
  const { bot, calls } = fakeBot();
  await runVoicePreview(bot, voiceInteraction(), deps({
    limiter: createConcurrencyLimiter(0),
  }));
  assertEquals(calls[0].body.data, {});
  assert(textOf(calls[1]).includes("Voice transcription is busy. Try again in a moment."));
});

Deno.test("releases the slot so a later call can run", async () => {
  const { bot, calls } = fakeBot();
  const used = deps({ limiter: createConcurrencyLimiter(1) });
  await runVoicePreview(bot, voiceInteraction(), used);
  await runVoicePreview(bot, voiceInteraction(), used);
  assertEquals(calls.filter((call) => call.kind === "edit").length, 2);
});

Deno.test("a held slot makes the overlapping call busy", async () => {
  const limiter = createConcurrencyLimiter(1);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  const used = deps({
    limiter,
    transcribe: () => {
      started = true;
      return gate.then(() => ({ text: "one", language: "en" }));
    },
  });
  const first = fakeBot();
  const second = fakeBot();
  const pending = runVoicePreview(first.bot, voiceInteraction(), used);
  try {
    for (let i = 0; i < 50 && !started; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assertEquals(started, true);
    await runVoicePreview(second.bot, voiceInteraction(), used);
    assert(textOf(second.calls.find((call) => call.kind === "edit")).includes(
      "Voice transcription is busy. Try again in a moment.",
    ));
  } finally {
    release();
    await pending;
  }
  const third = fakeBot();
  await runVoicePreview(third.bot, voiceInteraction(), used);
  assert(textOf(third.calls.find((call) => call.kind === "edit")).includes("Voice Transcript"));
});

Deno.test("replaces a 400 edit with the too-long card", async () => {
  let edits = 0;
  const { bot, calls } = fakeBot(() => {
    edits += 1;
    if (edits === 1) throw { ok: false, status: 400, body: "content[BASE_TYPE_MAX_LENGTH]" };
  });
  await runVoicePreview(bot, voiceInteraction(), deps());
  assertEquals(calls.filter((call) => call.kind === "edit").length, 2);
  assert(textOf(calls[1]).includes("Voice Transcript"));
  assert(textOf(calls[2]).includes(TOO_LONG_TO_DISPLAY));
  assertEquals(textOf(calls[2]).includes("Voice Transcript"), false);
});

Deno.test("swallows a non-400 edit failure", async () => {
  const { bot } = fakeBot(() => {
    throw { ok: false, status: 500 };
  });
  await runVoicePreview(bot, voiceInteraction(), deps());
});

Deno.test("does not put a download URL into the error card", async () => {
  const { bot, calls } = fakeBot();
  await runVoicePreview(bot, voiceInteraction(), deps({
    download: () => Promise.reject(new TypeError(`failed ${CDN}`)),
  }));
  const card = textOf(calls[1]);
  assert(card.includes("Couldn't transcribe this voice message. Try again later."));
  assertEquals(card.includes(CDN), false);
  assertEquals(card.includes("failed"), false);
});

Deno.test("shows a conversion failure and frees the slot", async () => {
  const { bot, calls } = fakeBot();
  const used = deps({
    limiter: createConcurrencyLimiter(1),
    transcribe: async () => ({ text: "软件", language: "zh" }),
    convert: () => {
      throw new VoiceError("convert_failed");
    },
  });
  await runVoicePreview(bot, voiceInteraction(), used);
  assert(textOf(calls[1]).includes("Couldn't convert this transcript to Traditional Chinese."));
  const again = fakeBot();
  await runVoicePreview(again.bot, voiceInteraction(), {
    limiter: used.limiter,
    download: used.download,
    convert: (text) => text,
    transcriber: { transcribe: async () => ({ text: "ok", language: "en" }) },
  });
  assert(textOf(again.calls.find((call) => call.kind === "edit")).includes("ok"));
});

Deno.test("lets a failed public defer propagate", async () => {
  const bot = {
    helpers: {
      sendInteractionResponse() {
        return Promise.reject(new Error("discord down"));
      },
      editOriginalInteractionResponse() {
        return Promise.resolve();
      },
    },
  } as unknown as AnyBot;
  await assertRejects(() => runVoicePreview(bot, voiceInteraction(), deps()));
});
