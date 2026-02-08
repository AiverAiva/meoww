import { Command } from "./mod.ts";
import { pingCommand } from "./ping.ts";

export const commands = new Map<string, Command>();

// Register commands
commands.set(pingCommand.name, pingCommand);
