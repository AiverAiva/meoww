import {
  ApplicationCommandTypes,
  DiscordApplicationIntegrationType,
  DiscordInteractionContextType,
  InteractionResponseTypes,
} from "@discordeno/bot";
import { AnyBot, Command } from "../types.ts";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { createLogger } from "../utils/logger.ts";
import { createErrorCard, createVoiceTranscriptCard } from "../utils/ui_factory.ts";
import {
  DOWNLOAD_TIMEOUT_MS,
  MAX_AUDIO_BYTES,
  NO_SPEECH_PROB_THRESHOLD,
  STT_CONCURRENCY,
  STT_TIMEOUT_MS,
  TOO_LONG_TO_DISPLAY,
} from "../utils/voice/constants.ts";
import { maybeConvert } from "../utils/voice/convert.ts";
import { downloadDiscordAttachment } from "../utils/voice/download.ts";
import { createConcurrencyLimiter } from "../utils/voice/limit.ts";
import { neutralizeMentions } from "../utils/voice/mentions.ts";
import { voiceComponentPayload } from "../utils/voice/respond.ts";
import { selectVoiceAttachment } from "../utils/voice/select.ts";
import { createLocalTranscriber } from "../utils/voice/transcribe.ts";
import { formatMeta, isEmptyTranscript } from "../utils/voice/transcript.ts";
import {
  asVoiceError,
  outcomeOf,
  statusOf,
  userText,
} from "../utils/voice/types.ts";

const logger = createLogger("voice");

function envSetting(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

const limiter = createConcurrencyLimiter(STT_CONCURRENCY);
const transcriber = createLocalTranscriber({
  url: envSetting("STT_URL"),
  model: envSetting("STT_MODEL"),
});

export interface VoicePreviewDeps {
  limiter: ReturnType<typeof createConcurrencyLimiter>;
  transcriber: { transcribe: typeof transcriber.transcribe };
  download: typeof downloadDiscordAttachment;
  convert: typeof maybeConvert;
}

const defaultDeps: VoicePreviewDeps = {
  limiter,
  transcriber,
  download: downloadDiscordAttachment,
  convert: maybeConvert,
};

function editComponents(bot: AnyBot, token: string, components: unknown[]) {
  return bot.helpers.editOriginalInteractionResponse(
    token,
    voiceComponentPayload(components) as Parameters<
      AnyBot["helpers"]["editOriginalInteractionResponse"]
    >[1],
  );
}

async function editError(bot: AnyBot, token: string, text: string) {
  try {
    await editComponents(bot, token, [createErrorCard(text)]);
  } catch (error) {
    logger.error("Voice edit failed", {
      outcome: "edit_failed",
      status: statusOf(error),
    });
  }
}

async function respondPublicError(bot: AnyBot, interaction: { id: string; token: string }, text: string) {
  await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
    type: InteractionResponseTypes.ChannelMessageWithSource,
    data: {
      flags: IS_COMPONENTS_V2,
      allowedMentions: { parse: [] },
      components: [createErrorCard(text)] as unknown as import("@discordeno/bot").ActionRow[],
    },
  });
}

async function postTranscriptCard(
  bot: AnyBot,
  token: string,
  body: string,
  meta: string,
): Promise<boolean> {
  const card = createVoiceTranscriptCard(neutralizeMentions(body), meta);
  try {
    await editComponents(bot, token, [card]);
    return true;
  } catch (error) {
    if (statusOf(error) === 400) {
      await editError(bot, token, TOO_LONG_TO_DISPLAY);
      return false;
    }
    logger.error("Voice edit failed", {
      outcome: "edit_failed",
      status: statusOf(error),
    });
    return false;
  }
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

// deno-lint-ignore no-explicit-any
export async function runVoicePreview(bot: AnyBot, interaction: any, deps: VoicePreviewDeps = defaultDeps) {
  const message = interaction.data?.resolved?.messages?.values().next().value;
  const selected = selectVoiceAttachment(message);

  if (!selected.ok) {
    logger.debug("Voice transcript {outcome}", {
      outcome: "rejected",
      reason: selected.reason,
      messageId: message?.id,
      durationSecs: selected.durationSecs,
      bytes: selected.bytes,
    });
    return await respondPublicError(bot, interaction, userText(selected.reason));
  }

  await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
    type: InteractionResponseTypes.DeferredChannelMessageWithSource,
    data: {},
  });

  const slot = deps.limiter.tryAcquire();
  if (!slot) {
    logger.info("Voice transcript {outcome}", {
      outcome: "busy",
      messageId: message?.id,
    });
    return await editError(bot, interaction.token, userText("busy"));
  }

  let transcript: { text: string; language?: string; noSpeechProb?: number } | undefined;
  try {
    const downloadStarted = performance.now();
    const audio = await deps.download(selected.attachment.url, {
      maxBytes: MAX_AUDIO_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    const downloadMs = Math.round(performance.now() - downloadStarted);

    const sttStarted = performance.now();
    transcript = await deps.transcriber.transcribe(audio, {
      filename: selected.attachment.filename || "voice-message.ogg",
      contentType: selected.attachment.contentType,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
    const sttMs = Math.round(performance.now() - sttStarted);

    if (isEmptyTranscript(transcript)) {
      logger.info("Voice transcript {outcome}", {
        outcome: "stt_empty",
        messageId: message?.id,
        language: transcript.language,
        chars: 0,
        noSpeech: transcript.noSpeechProb !== undefined &&
          transcript.noSpeechProb >= NO_SPEECH_PROB_THRESHOLD,
      });
      return await editError(bot, interaction.token, userText("stt_empty"));
    }

    const converted = deps.convert(transcript.text, transcript.language);
    const shown = converted.trim();
    const meta = formatMeta(selected.attachment.duration_secs, transcript.language);
    const posted = await postTranscriptCard(bot, interaction.token, shown, meta);
    if (!posted) return;
    logger.info("Voice transcript {outcome}", {
      outcome: "stt_ok",
      messageId: message?.id,
      durationSecs: selected.attachment.duration_secs,
      bytes: audio.byteLength,
      downloadMs,
      sttMs,
      language: transcript.language,
      chars: neutralizeMentions(shown).length,
    });
  } catch (error) {
    const voice = asVoiceError(error);
    const outcome = outcomeOf(voice);
    const fields: Record<string, unknown> = {
      outcome,
      code: voice.code,
      status: voice.status,
      reason: voice.reason,
      messageId: message?.id,
    };
    if (voice.bytes !== undefined) fields.bytes = voice.bytes;
    if (voice.code === "download_failed") fields.host = hostOf(selected.attachment.url);
    if (voice.code === "convert_failed" && transcript) {
      fields.language = transcript.language;
      fields.chars = transcript.text.length;
    }
    if (outcome === "rejected") logger.debug("Voice transcript {outcome}", fields);
    else logger.error("Voice transcript {outcome}", fields);
    await editError(bot, interaction.token, userText(voice.code));
  } finally {
    slot.release();
  }
}

// deno-lint-ignore no-explicit-any
async function executeVoicePreview(bot: AnyBot, interaction: any) {
  await runVoicePreview(bot, interaction);
}

export const voicePreviewCommand: Command = {
  name: "Preview Voice",
  description: "",
  type: ApplicationCommandTypes.Message,
  integrationTypes: [
    DiscordApplicationIntegrationType.GuildInstall,
    DiscordApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    DiscordInteractionContextType.Guild,
    DiscordInteractionContextType.BotDm,
    DiscordInteractionContextType.PrivateChannel,
  ],
  execute: executeVoicePreview,
};
