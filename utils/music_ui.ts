import { ComponentV2Type } from "./components_v2.ts";
import { UI_COLORS } from "./ui_factory.ts";

function formatDuration(ms: number) {
  if (!ms || ms < 0) return "Unknown";
  if (ms >= 9223372036854775807) return "Live"; // Long.MAX_VALUE in Lavalink
  try {
    const date = new Date(ms);
    return date.getUTCHours() > 0
      ? date.toISOString().substr(11, 8)
      : date.toISOString().substr(14, 5);
  } catch {
    return "Unknown";
  }
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
      description: `${t.info.author} (${formatDuration(t.info.length)})`
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
                  label: "SoundCloud",
                  value: "scsearch",
                  default: source === "scsearch",
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}
