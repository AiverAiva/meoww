import { Command } from "./mod.ts";
import { pingCommand } from "./ping.ts";
import { previewCommand } from "./preview.ts";

export const commands = new Map<string, Command>();

// Register commands
commands.set(pingCommand.name, pingCommand);
commands.set(previewCommand.name, previewCommand);
