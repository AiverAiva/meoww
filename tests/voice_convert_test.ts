import { assertEquals, assertThrows } from "@std/assert";
import { maybeConvert, toTraditionalTaiwan } from "../utils/voice/convert.ts";
import { VoiceError } from "../utils/voice/types.ts";

Deno.test("converts Simplified and phrase variants to Taiwan Traditional", () => {
  assertEquals(toTraditionalTaiwan("软件"), "軟體");
  assertEquals(toTraditionalTaiwan("軟件"), "軟體");
});

Deno.test("converts only when the detected language is exactly zh", () => {
  assertEquals(maybeConvert("软件", "zh"), "軟體");
  assertEquals(maybeConvert("软件", "zh-cn"), "软件");
  assertEquals(maybeConvert("hello", "en"), "hello");
  assertEquals(maybeConvert("hello", undefined), "hello");
});

Deno.test("reports a conversion failure without returning the original text", () => {
  const thrown = assertThrows(
    () => toTraditionalTaiwan("软件", () => {
      throw new Error("dictionary missing");
    }),
    VoiceError,
  );
  assertEquals(thrown.code, "convert_failed");

  const bad = assertThrows(
    () => toTraditionalTaiwan("软件", () => 1 as unknown as string),
    VoiceError,
  );
  assertEquals(bad.code, "convert_failed");
});
