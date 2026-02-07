import { Bot } from "@discordeno/bot";

// deno-lint-ignore no-explicit-any
export type AnyBot = Bot<any, any>;

export interface Command {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  type?: any;
  /** The function to execute when the command is called. */
  // deno-lint-ignore no-explicit-any
  execute: (bot: AnyBot, interaction: any) => Promise<unknown> | unknown;
}
