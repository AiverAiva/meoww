import { Command } from "./mod.ts";
import { pingCommand } from "./ping.ts";
import { previewCommand } from "./preview.ts";
// import { musicCommand } from "./music.ts"; // Music: keep commented out while no Lavalink node is available
import { patpatCommand, patpatUserCommand, patpatMessageCommand } from "./patpat.ts";
import { latexCommand, latexMessageCommand } from "./latex.ts";
import { paletteCommand, paletteMessageCommand } from "./palette.ts";
import { honeypotCommand } from "./honeypot.ts";
import { voicePreviewCommand } from "./voice_preview.ts";

export const commands = new Map<string, Command>();

// Register commands
[
  pingCommand,
  previewCommand,
  // musicCommand, // Music: keep commented out while no Lavalink node is available
  patpatCommand,
  patpatUserCommand,
  patpatMessageCommand,
  latexCommand,
  latexMessageCommand,
  paletteCommand,
  paletteMessageCommand,
  honeypotCommand,
  voicePreviewCommand,
].forEach(cmd => {
  const type = cmd.type ?? 1; // Default to Slash Command (ChatInput)
  commands.set(`${cmd.name}:${type}`, cmd);
});
