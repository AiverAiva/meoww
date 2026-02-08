import { Event } from "../types.ts";
import { handleMessageCreate } from "../interactions/messages.ts";

export const messageCreateEvent: Event = {
  name: "messageCreate",
  execute: async (bot, message) => {
    await handleMessageCreate(bot, message);
  },
};
