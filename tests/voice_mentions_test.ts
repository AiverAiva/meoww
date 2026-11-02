import { assertEquals } from "@std/assert";
import { IS_COMPONENTS_V2 } from "../utils/components_v2.ts";
import { neutralizeMentions } from "../utils/voice/mentions.ts";
import { voiceComponentPayload } from "../utils/voice/respond.ts";

Deno.test("breaks mention markup without changing the visible words", () => {
  assertEquals(neutralizeMentions("@everyone"), "@\u200beveryone");
  assertEquals(neutralizeMentions("@here"), "@\u200bhere");
  assertEquals(neutralizeMentions("<@123>"), "<\u200b@123>");
  assertEquals(neutralizeMentions("<#456>"), "<\u200b#456>");
  assertEquals(neutralizeMentions("</preview:1>"), "<\u200b/preview:1>");
  const combined = neutralizeMentions("hi @everyone <@1> <#2> </cmd> @here");
  assertEquals(combined.includes("@everyone"), false);
  assertEquals(combined.includes("<@"), false);
  assertEquals(combined.includes("<#"), false);
  assertEquals(combined.includes("</"), false);
  assertEquals(combined.includes("@here"), false);
});

Deno.test("sends components without an allowed mention parse", () => {
  const payload = voiceComponentPayload([{ type: 17 }]);
  assertEquals(payload.flags, IS_COMPONENTS_V2);
  assertEquals(payload.flags & (1 << 6), 0);
  assertEquals(payload.allowedMentions, { parse: [] });
});
