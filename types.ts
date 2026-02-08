import { Bot } from "@discordeno/bot";

/**
 * A generic Bot type to simplify event handlers without complex DesiredProperties generics.
 */
// deno-lint-ignore no-explicit-any
export type AnyBot = Bot<any, any>;

export interface Command {
  name: string;
  description: string;
  type?: number;
  integrationTypes?: number[];
  contexts?: number[];
  /** The function to execute when the command is called. */
  // deno-lint-ignore no-explicit-any
  execute: (bot: AnyBot, interaction: any) => Promise<unknown> | unknown;
}

export interface Event {
  name: string;
  // deno-lint-ignore no-explicit-any
  execute: (bot: AnyBot, ...args: any[]) => Promise<unknown> | unknown;
}

/**
 * A listener for specific message conditions.
 */
export interface MessageListener {
  name: string;
  /**
   * Filters if this listener should run for the given message.
   */
  // deno-lint-ignore no-explicit-any
  filter: (message: any) => boolean | Promise<boolean>;
  /**
   * The logic to run if the filter passes.
   */
  // deno-lint-ignore no-explicit-any
  execute: (bot: AnyBot, message: any) => Promise<unknown> | unknown;
}
