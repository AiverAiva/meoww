import { assertEquals, assertRejects } from "@std/assert";
import { downloadDiscordAttachment } from "../utils/voice/download.ts";
import { VoiceError } from "../utils/voice/types.ts";

const URL = "https://cdn.discordapp.com/attachments/1/2/voice-message.ogg?ex=1&is=2&hm=3";
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);

function fetchOf(response: Response | (() => Response | Promise<Response>)) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init });
    const result = typeof response === "function" ? response() : response;
    return Promise.resolve(result);
  };
  return { fetchImpl, calls };
}

Deno.test("downloads a CDN attachment without a bot token", async () => {
  const { fetchImpl, calls } = fetchOf(new Response(OGG, { status: 200 }));
  const audio = await downloadDiscordAttachment(URL, {
    maxBytes: 1024,
    timeoutMs: 1000,
    fetchImpl,
  });
  assertEquals(audio, OGG);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, URL);
  assertEquals(calls[0].init?.method, "GET");
  assertEquals(calls[0].init?.redirect, "error");
  assertEquals(calls[0].init?.headers, undefined);
});

Deno.test("treats a declared content-length over the cap as too large", async () => {
  const { fetchImpl } = fetchOf(new Response(OGG, {
    status: 200,
    headers: { "content-length": "100" },
  }));
  const error = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl }),
    VoiceError,
  );
  assertEquals(error.code, "too_large");
  assertEquals(error.bytes, 100);
});

Deno.test("stops reading once the streamed body passes the cap", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.enqueue(new Uint8Array([5, 6]));
      controller.close();
    },
  });
  const { fetchImpl } = fetchOf(new Response(stream, { status: 200 }));
  const error = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 4, timeoutMs: 1000, fetchImpl }),
    VoiceError,
  );
  assertEquals(error.code, "too_large");
  assertEquals(error.bytes, 6);
});

Deno.test("accepts a body that lands exactly on the cap", async () => {
  const body = new Uint8Array([1, 2, 3, 4]);
  const { fetchImpl } = fetchOf(new Response(body, {
    status: 200,
    headers: { "content-length": "nope" },
  }));
  const audio = await downloadDiscordAttachment(URL, {
    maxBytes: 4,
    timeoutMs: 1000,
    fetchImpl,
  });
  assertEquals(audio, body);
});

Deno.test("treats an empty body as a failed download", async () => {
  const cases = [
    new Response(new Uint8Array(), { status: 200, headers: { "content-length": "0" } }),
    new Response(null, { status: 200 }),
  ];
  for (const response of cases) {
    const { fetchImpl } = fetchOf(response);
    const error = await assertRejects(
      () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl }),
      VoiceError,
    );
    assertEquals(error.code, "download_failed");
    assertEquals(error.reason, "empty");
  }
});

Deno.test("maps HTTP failures, timeouts, and network errors", async () => {
  const denied = fetchOf(new Response("no", { status: 401 }));
  const unauthorized = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl: denied.fetchImpl }),
    VoiceError,
  );
  assertEquals(unauthorized.status, 401);

  const timedOut = fetchOf(() => {
    throw new DOMException("The operation was aborted", "TimeoutError");
  });
  const timeout = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl: timedOut.fetchImpl }),
    VoiceError,
  );
  assertEquals(timeout.reason, "timeout");
  assertEquals(timeout.message, "download_failed");

  const aborted = fetchOf(() => {
    throw new DOMException("aborted", "AbortError");
  });
  const abort = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl: aborted.fetchImpl }),
    VoiceError,
  );
  assertEquals(abort.reason, "timeout");

  const offline = fetchOf(() => {
    throw new TypeError("network down");
  });
  const network = await assertRejects(
    () => downloadDiscordAttachment(URL, { maxBytes: 10, timeoutMs: 1000, fetchImpl: offline.fetchImpl }),
    VoiceError,
  );
  assertEquals(network.reason, "network");
  assertEquals(network.message, "download_failed");
});

Deno.test("refuses a non-CDN URL before fetching", async () => {
  let called = false;
  const fetchImpl: typeof fetch = () => {
    called = true;
    return Promise.resolve(new Response(OGG));
  };
  const error = await assertRejects(
    () =>
      downloadDiscordAttachment("https://example.com/voice.ogg", {
        maxBytes: 10,
        timeoutMs: 1000,
        fetchImpl,
      }),
    VoiceError,
  );
  assertEquals(error.reason, "bad_host");
  assertEquals(called, false);
});
