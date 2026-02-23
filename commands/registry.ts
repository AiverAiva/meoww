import { Command } from "./mod.ts";
import { pingCommand } from "./ping.ts";
import { previewCommand } from "./preview.ts";
import { musicCommand } from "./music.ts";

export const commands = new Map<string, Command>();

// Register commands
commands.set(pingCommand.name, pingCommand);
commands.set(previewCommand.name, previewCommand);
commands.set(musicCommand.name, musicCommand);
