import { parseDiscordCdnUrl } from "./select.ts";
import { isTimeoutError, VoiceError } from "./types.ts";

export async function downloadDiscordAttachment(
  url: string,
  opts: { maxBytes: number; timeoutMs: number; fetchImpl?: typeof fetch },
): Promise<Uint8Array> {
  const parsed = parseDiscordCdnUrl(url);
  if (!parsed) {
    throw new VoiceError("download_failed", { reason: "bad_host" });
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(parsed.href, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (error) {
    throw new VoiceError("download_failed", {
      reason: isTimeoutError(error) ? "timeout" : "network",
    });
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new VoiceError("download_failed", { status: response.status });
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > opts.maxBytes) {
    await response.body?.cancel();
    throw new VoiceError("too_large", { bytes: declared });
  }

  if (!response.body) {
    throw new VoiceError("download_failed", { reason: "empty" });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new VoiceError("too_large", { bytes: total });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw new VoiceError("download_failed", {
      reason: isTimeoutError(error) ? "timeout" : "network",
    });
  }

  if (total === 0) {
    throw new VoiceError("download_failed", { reason: "empty" });
  }

  const audio = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return audio;
}
