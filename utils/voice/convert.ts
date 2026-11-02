import OpenCC from "opencc-js";
import { VoiceError } from "./types.ts";

const toTaiwan = OpenCC.Converter({ from: "cn", to: "twp" });

export function toTraditionalTaiwan(
  text: string,
  convert: (text: string) => string = toTaiwan,
): string {
  try {
    const converted = convert(text);
    if (typeof converted !== "string") throw new VoiceError("convert_failed");
    return converted;
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw new VoiceError("convert_failed");
  }
}

export function maybeConvert(text: string, language: string | undefined): string {
  if (language !== "zh") return text;
  return toTraditionalTaiwan(text);
}
