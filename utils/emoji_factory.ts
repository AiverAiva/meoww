export const EMOJIS = {
  progress_fill_end: "<:progress_fill_end:1455261482647289982>",
  progress_start_0: "<:progress_start_0:1455261031814139945>",
  progress_start: "<:progress_start:1455260746744336542>",
  progress_fill: "<:progress_fill:1455260744995307540>",
  progress_mix: "<:progress_mix:1455260743183241301>",
  progress: "<:progress:1455260741455314964>",
  progress_end: "<:progress_end:1455260739966337321>",
  youtube: "🎥", // Placeholder icon
};

/**
 * Generates a 10-block progress bar using custom emojis.
 * @param current Current time in ms
 * @param total Total duration in ms
 */
export function createProgressBar(current: number, total: number): string {
  if (total <= 0) {
    return (
      EMOJIS.progress_start_0 +
      EMOJIS.progress.repeat(8) +
      EMOJIS.progress_end
    );
  }
  
  // Calculate progress on a scale of 0 to 10
  const progress = Math.max(0, Math.min(10, Math.floor((current / total) * 10)));
  
  if (progress <= 0) {
    return (
      EMOJIS.progress_start_0 +
      EMOJIS.progress.repeat(8) +
      EMOJIS.progress_end
    );
  }
  
  if (progress === 1) {
    return (
      EMOJIS.progress_start +
      EMOJIS.progress_mix +
      EMOJIS.progress.repeat(7) +
      EMOJIS.progress_end
    );
  }
  
  if (progress >= 10) {
    return (
      EMOJIS.progress_start +
      EMOJIS.progress_fill.repeat(8) +
      EMOJIS.progress_fill_end
    );
  }
  
  // Middle cases (2 to 9)
  const fills = progress - 1;
  const empty = Math.max(0, 8 - progress);
  
  return (
    EMOJIS.progress_start +
    EMOJIS.progress_fill.repeat(fills) +
    EMOJIS.progress_mix +
    EMOJIS.progress.repeat(empty) +
    EMOJIS.progress_end
  );
}
