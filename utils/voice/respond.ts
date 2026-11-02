import type { AllowedMentions } from "@discordeno/bot";
import { IS_COMPONENTS_V2 } from "../components_v2.ts";

export const VOICE_ALLOWED_MENTIONS: AllowedMentions = { parse: [] };

export function voiceComponentPayload(components: unknown[]) {
  return {
    flags: IS_COMPONENTS_V2,
    allowedMentions: VOICE_ALLOWED_MENTIONS,
    components,
  };
}
