import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  createLocalTranscriber,
  noSpeechProbOf,
  readTranscriptPayload,
} from "../utils/voice/transcribe.ts";
import { VoiceError } from "../utils/voice/types.ts";

const ENDPOINT = "http://stt.example/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";
const AUDIO = new Uint8Array([1, 2, 3, 4]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("posts multipart audio without language, prompt, or an auth header", async () => {
  let form: FormData | undefined;
  let method: string | undefined;
  let headers: unknown;
  let url = "";
  const fetchImpl: typeof fetch = (input, options) => {
    const request = options as { method?: string; headers?: unknown; body?: FormData } | undefined;
    url = String(input);
    method = request?.method;
    headers = request?.headers;
    form = request?.body;
    return Promise.resolve(jsonResponse({ text: "The meeting moved to 3 o'clock.", language: "en" }));
  };
  const transcriber = createLocalTranscriber({
    url: ENDPOINT,
    model: MODEL,
    fetchImpl,
  });
  const result = await transcriber.transcribe(AUDIO, {
    filename: 'room"\n.ogg',
    contentType: "audio/ogg; codecs=opus",
    signal: AbortSignal.timeout(1000),
  });

  assertEquals(url, ENDPOINT);
  assertEquals(method, "POST");
  assertEquals(headers, undefined);
  assert(form);
  assertEquals(new Set(form.keys()), new Set(["file", "model", "response_format", "temperature"]));
  assertEquals(form.get("model"), "whisper-large-v3");
  assertEquals(form.get("response_format"), "verbose_json");
  assertEquals(form.get("temperature"), "0");
  assertEquals(form.get("language"), null);
  assertEquals(form.get("prompt"), null);
  const file = form.get("file");
  assert(file instanceof File);
  assertEquals(file.name, "room.ogg");
  assertEquals(file.type, "audio/ogg");
  assertEquals(new Uint8Array(await file.arrayBuffer()), AUDIO);
  assertEquals(result, { text: "The meeting moved to 3 o'clock.", language: "en", noSpeechProb: undefined });
});

Deno.test("reads text and language when the server omits segments", () => {
  assertEquals(readTranscriptPayload({ text: "hi", language: "zh" }), {
    text: "hi",
    language: "zh",
    noSpeechProb: undefined,
  });
  assertEquals(readTranscriptPayload({ text: "hi", language: "" }).language, undefined);
  assertEquals(noSpeechProbOf([]), undefined);
  assertEquals(noSpeechProbOf([{ no_speech_prob: 0.8 }, { no_speech_prob: 0.2 }]), 0.2);
  assertEquals(noSpeechProbOf([{ no_speech_prob: 0.2 }, { text: "x" }]), undefined);
});

Deno.test("rejects a payload that has no string text", () => {
  for (const payload of [null, [], { language: "en" }, { text: 1 }]) {
    const error = assertThrowsPayload(payload);
    assertEquals(error.code, "stt_failed");
    assertEquals(error.reason, "bad_json");
  }
});

function assertThrowsPayload(payload: unknown): VoiceError {
  try {
    readTranscriptPayload(payload);
  } catch (error) {
    if (error instanceof VoiceError) return error;
    throw error;
  }
  throw new Error("expected VoiceError");
}

Deno.test("maps transcription HTTP statuses and does not fetch a bad config", async () => {
  const transcribe = (status: number) =>
    createLocalTranscriber({
      url: ENDPOINT,
      model: "whisper-large-v3",
      fetchImpl: () => Promise.resolve(new Response("no", { status })),
    }).transcribe(AUDIO, {
      filename: "voice-message.ogg",
      contentType: "audio/mpeg",
      signal: AbortSignal.timeout(1000),
    });

  assertEquals((await assertRejects(() => transcribe(401), VoiceError)).code, "stt_unauthorized");
  assertEquals((await assertRejects(() => transcribe(403), VoiceError)).code, "stt_unauthorized");
  assertEquals((await assertRejects(() => transcribe(429), VoiceError)).code, "stt_rate_limited");
  const failed = await assertRejects(() => transcribe(500), VoiceError);
  assertEquals(failed.code, "stt_failed");
  assertEquals(failed.status, 500);

  const badJson = createLocalTranscriber({
    url: ENDPOINT,
    model: "large-v3",
    fetchImpl: () => Promise.resolve(new Response("not-json", { status: 200 })),
  });
  const parsed = await assertRejects(
    () =>
      badJson.transcribe(AUDIO, {
        filename: "",
        contentType: "text/plain",
        signal: AbortSignal.timeout(1000),
      }),
    VoiceError,
  );
  assertEquals(parsed.reason, "bad_json");

  let called = false;
  const blank = createLocalTranscriber({
    url: "   ",
    model: "whisper-large-v3",
    fetchImpl: () => {
      called = true;
      return Promise.resolve(new Response());
    },
  });
  const missing = await assertRejects(
    () =>
      blank.transcribe(AUDIO, {
        filename: "a.ogg",
        contentType: "audio/ogg",
        signal: AbortSignal.timeout(1000),
      }),
    VoiceError,
  );
  assertEquals(missing.code, "stt_unconfigured");
  assertEquals(missing.reason, "missing_url");
  assertEquals(called, false);

  const badModel = await assertRejects(
    () =>
      createLocalTranscriber({ url: ENDPOINT, model: "bad model" }).transcribe(AUDIO, {
        filename: "a.ogg",
        contentType: "audio/ogg",
        signal: AbortSignal.timeout(1000),
      }),
    VoiceError,
  );
  assertEquals(badModel.reason, "invalid_model");
});

Deno.test("maps an aborted transcription request to a timeout", async () => {
  const transcriber = createLocalTranscriber({
    url: ENDPOINT,
    model: "whisper-large-v3",
    fetchImpl: () => {
      throw new DOMException("aborted", "AbortError");
    },
  });
  const error = await assertRejects(
    () =>
      transcriber.transcribe(AUDIO, {
        filename: "a.ogg",
        contentType: "audio/ogg",
        signal: AbortSignal.timeout(1000),
      }),
    VoiceError,
  );
  assertEquals(error.code, "stt_failed");
  assertEquals(error.reason, "timeout");
});
