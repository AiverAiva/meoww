export function neutralizeMentions(text: string): string {
  return text
    .replaceAll("@everyone", "@\u200beveryone")
    .replaceAll("@here", "@\u200bhere")
    .replaceAll("<@", "<\u200b@")
    .replaceAll("<#", "<\u200b#")
    .replaceAll("</", "<\u200b/");
}
