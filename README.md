# 🐾 Meoww

A modern Discord bot built with Deno 2 and Discordeno v21, featuring smart link previews, music playback, and fun interactions.

[![Deno](https://img.shields.io/badge/Deno-2.x-00D9FF?logo=deno&logoColor=ffffff)](https://deno.com)
[![Discordeno](https://img.shields.io/badge/Discordeno-v21-7289DA?logo=discord)](https://discordeno.moderndeno.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?)](LICENSE)

## ✨ Features

### 🔗 Smart Link Previews

Preview links from popular platforms directly in Discord. Supported platforms:

| Platform | Support Type | Auto Preview |
|----------|-------------|--------------|
| Twitter / X | Full | Yes |
| Pornhub | Full | Yes |
| Pixiv | Full | Yes |
| WNACG | Full | Yes |
| nHentai | Full | Yes |

### 🎵 Music Playback

Lavalink-based music system with rich features:

- **Queue Management**: Add, remove, and organize your music queue
- **Auto-Disconnect**: Automatically leaves when the voice channel is empty
- **Now Playing**: Displays current track information with controls
- **High Quality**: Streams audio without quality loss

### 💝 Fun Interactions

Express yourself with animated GIF interactions:

- **Patpat Command**: Use `/patpat` as a slash command or right-click menu action
- **Animated GIFs**: Custom GIF generation with avatar overlays
- **Smooth Animations**: Frame-based GIF creation for fluid motion

### 🛡️ Safety Features

- **NSFW Detection**: Automatically detects and handles NSFW content appropriately
- **Channel Validation**: Ensures commands are used in appropriate channels

### 🏗️ Modern Architecture

Built with modern development practices:

- **Modular Commands**: Clean, organized command structure
- **Component V2 UI**: Modern Discord interaction components
- **Event-Driven**: Responsive event handling system
- **LogTape Logging**: Structured, performant logging

## 📋 Requirements

### Prerequisites

- **Deno 2.x** — [Install Deno](https://deno.com/#installation)
- **Discord Bot Token** — [Create a Discord Application](https://discord.com/developers/applications)
- **Lavalink Server** (optional) — Required for music playback

### Discord Intents

Your bot requires the following intents:

| Intent | Purpose |
|--------|---------|
| Guilds | Access to server information |
| GuildMessages | Message events in servers |
| MessageContent | Read message content |
| GuildVoiceStates | Voice state updates for music |

## 🚀 Getting Started

### 1. Clone and Configure

```bash
git clone https://github.com/AiverAiva/meoww.git
cd meoww
cp .env.example .env
```

### 2. Configure Environment

Edit the `.env` file with your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token_here
LAVALINK_HOST=localhost:2333
LAVALINK_PASSWORD=your_lavalink_password
```

### 3. Run the Bot

**Development mode** (with file watching):

```bash
deno task dev
```

**Production mode:**

```bash
deno task start
```

## 🐳 Docker Deployment

### Building the Image

```bash
docker build -t meoww-bot .
```

### Running the Container

```bash
docker run -d \
  --name meoww \
  -e DISCORD_TOKEN=your_token \
  -e LAVALINK_HOST=lavalink-server \
  -e LAVALINK_PASSWORD=your_password \
  meoww-bot
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  meoww:
    build: .
    container_name: meoww
    environment:
      DISCORD_TOKEN: your_discord_bot_token_here
      LAVALINK_HOST: lavalink:2333
      LAVALINK_PASSWORD: your_lavalink_password
    depends_on:
      - lavalink

  lavalink:
    image: ghcr.io/lavalink-devs/lavalink:4
    container_name: lavalink
    environment:
      SERVER_PORT: 2333
      LAVALINK_ADMIN_PASSWORD: your_lavalink_password
    volumes:
      - lavalink_data:/home/lavalink

volumes:
  lavalink_data:
```

Start with:

```bash
docker-compose up -d
```

## 📁 Project Structure

```
meoww/
├── assets/
│   └── patpat/
│       ├── bg.png              # Patpat GIF background
│       ├── overlay.png         # Avatar overlay mask
│       ├── cat.png             # Cat ears overlay
│       ├── cat Overlay.png     # Secondary cat overlay
│       ├── 1.png to 24.png     # GIF animation frames
│       └── fonts/
│           └── impact.ttf      # Font for text rendering
│
├── commands/                   # Bot commands
│   ├── mod.ts                  # Command module exports
│   ├── registry.ts             # Command registry and mapping
│   ├── ping.ts                 # Ping command (Component V2 example)
│   ├── patpat.ts               # Patpat GIF generation command
│   ├── preview.ts              # Link preview command
│   └── music.ts                # Music playback commands
│
├── events/                     # Event handlers
│   ├── mod.ts                  # Event module exports
│   ├── ready.ts                # Bot ready event handler
│   ├── interactionCreate.ts    # Slash/button/select menu handlers
│   └── messageCreate.ts        # Message event handlers
│
├── interactions/               # Interaction definitions
│   ├── commands/                # Slash command definitions
│   ├── components/             # Button and select menu handlers
│   └── messages/               # Message component handlers
│
├── listeners/
│   └── message/                # Message-based listeners
│       └── autoResponders.ts   # Auto-response handlers
│
├── utils/                      # Utility modules
│   ├── previewers/             # Link preview fetchers
│   │   ├── mod.ts              # Preview aggregator (getAnyPreview)
│   │   ├── twitter.ts          # Twitter/X preview
│   │   ├── pornhub.ts          # Pornhub preview
│   │   ├── pixiv.ts            # Pixiv preview
│   │   ├── wnacg.ts            # WNACG preview
│   │   └── nhentai.ts          # nHentai preview
│   │
│   ├── gif/                    # GIF generation utilities
│   │   └── patpat_generator.ts # Patpat GIF builder
│   │
│   ├── logger.ts               # LogTape logger configuration
│   ├── lavalink.ts             # Lavalink manager setup
│   ├── components_v2.ts         # Component V2 helpers
│   └── ui_factory.ts           # UI element factory
│
├── main.ts                     # Bot entry point
├── deno.json                   # Deno configuration
├── Dockerfile                  # Docker build file
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
└── LICENSE                     # MIT License
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | — | Your Discord bot token |
| `LAVALINK_HOST` | No | localhost:2333 | Lavalink server (include port like `localhost:2333`) |
| `LAVALINK_PASSWORD` | No | youshallnotpass | Lavalink server password |

### Discord Intents

| Intent | Enabled | Reason |
|--------|---------|--------|
| Guilds | Yes | Required for server access |
| GuildMessages | Yes | Message event handling |
| MessageContent | Yes | Link detection |
| GuildVoiceStates | Yes | Music playback |

## 📚 Commands Reference

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ping` | Basic ping command to verify bot is responsive |
| `/patpat [user]` | Send a patpat GIF to the specified user |

### Message Context Menu

| Command | Description |
|---------|-------------|
| Preview Link | Right-click any message with a link to preview it |

### User Context Menu

| Command | Description |
|---------|-------------|
| patpat | Right-click a user to send them a patpat GIF |

## 🛠️ Development Guide

### Adding a New Command

Create a new command file in `commands/`:

```typescript
// commands/mycommand.ts
import { type Command, createCommand } from "../deps.ts";

export const myCommand = createCommand({
  meta: {
    name: "mycommand",
    description: "Description of my command",
  },
  contextMenu: {
    type: "message" as const, // or "user"
    // For slash commands, omit contextMenu
  },
  run(ctx) {
    // Your command logic here
    return ctx.respond({
      content: "Hello from my command!",
    });
  },
});
```

Register in `commands/mod.ts`:

```typescript
import { myCommand } from "./mycommand.ts";

export const commands = [pingCommand, previewCommand, patpatCommand, myCommand];
```

### Adding a Link Previewer

Create a new previewer in `utils/previewers/`:

```typescript
// utils/previewers/myplatform.ts
import type { PreviewResult } from "./mod.ts";

const MYPLATFORM_REGEX = /myplatform\.com\/watch\?v=(\w+)/;

export async function fetchMyPlatform(url: string): Promise<PreviewResult | null> {
  const match = url.match(MYPLATFORM_REGEX);
  if (!match) return null;

  // Fetch and parse the page
  const response = await fetch(url);
  const html = await response.text();

  // Extract metadata
  const title = extractTitle(html);
  const thumbnail = extractThumbnail(html);

  return {
    title,
    description: "My platform content",
    thumbnail,
    url,
  };
}
```

Register in `utils/previewers/mod.ts`:

```typescript
import { fetchMyPlatform } from "./myplatform.ts";

export async function getAnyPreview(url: string): Promise<PreviewResult | null> {
  // Chain through existing previewers
  return (
    await fetchTwitter(url) ||
    await fetchPornhub(url) ||
    await fetchPixiv(url) ||
    await fetchWNACG(url) ||
    await fetchNhentai(url) ||
    await fetchMyPlatform(url) ||  // Add your new previewer here
    null
  );
}
```

### Adding an Event Handler

Create an event file in `events/`:

```typescript
// events/myEvent.ts
import type { Bot, EventOptions } from "../deps.ts";

export const myEvent: EventOptions = {
  name: "myEvent",
  type: "once" as const, // or "every"
  run(bot: Bot) {
    // Your event logic
    console.log("My event fired!");
  },
};
```

Register in `events/mod.ts`:

```typescript
import { myEvent } from "./myEvent.ts";

export const events = [readyEvent, interactionCreateEvent, messageCreateEvent, myEvent];
```

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 💬 Support

If you have questions or need help, feel free to:
- Open an issue on GitHub
- Submit a pull request

For bugs or feature requests, please use GitHub Issues.

## 📄 License

This project is licensed under the MIT License.

View the full license: [LICENSE](LICENSE)

Created by **AiverAiva💜**

## 🙏 Acknowledgments

- **[Discordeno](https://discordeno.moderndeno.dev)** — Powerful Discord API wrapper for Deno
- **[LogTape](https://github.com/LogTape/logtape-deno)** — Structured logging for Deno applications
- **[lavalink-client](https://github.com/LavalinkDevs/lavalink-client)** — Lavalink integration for Discord bots
- **[jimp](https://github.com/jimp-dev/jimp)** — Image processing in pure JavaScript

---

<div align="center">

Made with ❤️ and Deno

</div>
