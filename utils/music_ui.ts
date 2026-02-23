import { ComponentV2Type } from "./components_v2.ts";
import { UI_COLORS } from "./ui_factory.ts";
import { createProgressBar } from "./emoji_factory.ts";

export function formatDuration(ms: number) {
  if (!ms || ms < 0) return "00:00";
  if (ms >= 9223372036854775807) return "Live";
  try {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${
        remainingMinutes.toString().padStart(2, "0")
      }:${seconds.toString().padStart(2, "0")}`;
    }
    return `${remainingMinutes.toString().padStart(2, "0")}:${
      seconds.toString().padStart(2, "0")
    }`;
  } catch {
    return "00:00";
  }
}

export function createNowPlayingUI(
  // deno-lint-ignore no-explicit-any
  player: any,
  // deno-lint-ignore no-explicit-any
  // deno-lint-ignore no-explicit-any
  track: any,
  finished = false,
) {
  const total = track.info.length || track.info.duration || 0;
  // If finished, force current to be exactly total
  const current = finished ? total : (player.position || 0);
  const progressBar = createProgressBar(current, total);

  // Queue info
  const queueCount = player.queue.tracks.length;
  const nextTracks = player.queue.tracks.slice(0, 3);
  let queueText = "";
  if (nextTracks.length > 0) {
    queueText = `\n\n**💭 Next (${queueCount} left)**\n` +
      nextTracks.map((t: any) => `- [${t.info.title}](${t.info.uri}) \`${formatDuration(t.info.length || t.info.duration)}\``).join("\n");
  }

  const title = finished ? "✅ Finished" : "🎶 Now Playing";
  const displayCurrent = finished ? total : current;

  return [
    {
      type: ComponentV2Type.Container,
      accent_color: finished ? UI_COLORS.INFO : UI_COLORS.SUCCESS,
      components: [
        {
          type: ComponentV2Type.TextDisplay,
          content: `### ${title}\n[**${track.info.title}**](${track.info.uri})\n\n` +
            `\`${formatDuration(displayCurrent)}\`${progressBar}\`${formatDuration(total)}\`` +
            queueText,
        },
      ],
    },
  ];
}

export function createMusicSearchUI(
  query: string,
  source: string,
  // deno-lint-ignore no-explicit-any
  tracks: any[],
  errorMessage?: string,
) {
  // deno-lint-ignore no-explicit-any
  const trackOptions = tracks.map((t: any, i: number) => {
    // Logic for value: Use URI if short enough, otherwise prefix identifier with source
    let val = t.info.uri;
    if (!val || val.length > 100) {
      val = `${source}:${t.info.identifier}`;
    }
    // Final safety truncation
    val = val.substring(0, 100);

    return {
      label: `${i + 1}. ${t.info.title}`.substring(0, 100),
      value: val,
      description: `${t.info.author} (${formatDuration(t.info.length || t.info.duration)})`
        .substring(0, 100),
    };
  });

  return [
    {
      type: ComponentV2Type.Container,
      accent_color: UI_COLORS.INFO,
      components: [
        {
          type: ComponentV2Type.TextDisplay,
          content: errorMessage
            ? `### ⚠️ Error on ${source}\nLavalink reported an error: \`${errorMessage}\`\nTry another platform below:`
            : tracks.length > 0
            ? `### 🎵 Search Results (${source}): ${query}\nSelect a track to play:`
            : `### 🔍 Search: ${query}\nNo results found on **${source}**. Try another platform:`,
        },
        ...(tracks.length > 0
          ? [{
            type: ComponentV2Type.ActionRow,
            components: [
              {
                type: ComponentV2Type.StringSelect,
                custom_id: `music_select_track`,
                placeholder: "Select a song to play",
                options: trackOptions,
              },
            ],
          }]
          : []),
        {
          type: ComponentV2Type.ActionRow,
          components: [
            {
              type: ComponentV2Type.StringSelect,
              custom_id: `music_search_source:${query}`,
              placeholder: "Change Platform",
              options: [
                {
                  label: "YouTube",
                  value: "ytsearch",
                  default: source === "ytsearch",
                },
                {
                  label: "YouTube Music",
                  value: "ytmsearch",
                  default: source === "ytmsearch",
                },
                {
                  label: "Spotify",
                  value: "spsearch",
                  default: source === "spsearch",
                },
                {
                  label: "Apple Music",
                  value: "amsearch",
                  default: source === "amsearch",
                },
                {
                  label: "Deezer",
                  value: "dzsearch",
                  default: source === "dzsearch",
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}
