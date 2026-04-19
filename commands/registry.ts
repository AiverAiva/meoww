import { Command } from "./mod.ts";
import { pingCommand } from "./ping.ts";
import { previewCommand } from "./preview.ts";
import { musicCommand } from "./music.ts";
import { patpatCommand, patpatUserCommand, patpatMessageCommand } from "./patpat.ts";
import { latexCommand, latexMessageCommand } from "./latex.ts";

export const commands = new Map<string, Command>();

// Register commands
[
  pingCommand,
  previewCommand,
  musicCommand,
  patpatCommand,
  patpatUserCommand,
  patpatMessageCommand,
  latexCommand,
  latexMessageCommand,
].forEach(cmd => {
  const type = cmd.type ?? 1; // Default to Slash Command (ChatInput)
  commands.set(`${cmd.name}:${type}`, cmd);
});
