/**
 * Decodes HTML entities in a string.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&comma;": ",",
    "&period;": ".",
    "&lbrack;": "[",
    "&rsqb;": "]",
    "&lpar;": "(",
    "&rpar;": ")",
    "&semi;": ";",
    "&colon;": ":",
    "&vert;": "|",
  };

  // Replace named entities
  let decoded = text.replace(/&[a-z0-9]+;/gi, (match) => {
    const lowerMatch = match.toLowerCase();
    return entities[lowerMatch] || match;
  });

  // Replace numeric entities (decimal)
  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  // Replace numeric entities (hex)
  decoded = decoded.replace(/&#x([a-f0-9]+);/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}
