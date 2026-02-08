# Meoww Discord Bot (Discordeno + Deno)

This project was initialized using the official Deno method and set up with a
Discordeno bot.

## Getting Started

1. **Set your Token**: Edit the `.env` file and replace `your_token_here` with
   your actual Discord Bot Token.

2. **Run the Bot**: Use the following command to run the bot:
   ```bash
   deno task start
   ```

   For development with auto-reload:
   ```bash
   deno task dev
   ```

## Features

- Built with **Deno 2**
- Powered by **Discordeno v21**
- **LogTape Integration**: Beautiful, structured, and scalable logging system
  with a pretty terminal formatter.
- **Scalable Command System**: Modular command handling (Slash commands) for
  easy expansion.
- Automatic environment variable loading via `@std/dotenv`.
- Example `/ping` (Slash) and `!ping` (Prefix) commands included.

## Permissions

The bot requires `--allow-net`, `--allow-env`, and `--allow-read` permissions to
communicate with Discord and read the `.env` file. These are handled
automatically by the `deno task` commands.
