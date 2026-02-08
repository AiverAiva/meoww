import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { prettyFormatter } from "@logtape/pretty";

// Configure LogTape
await configure({
  sinks: {
    console: getConsoleSink({
      formatter: prettyFormatter,
    }),
  },
  filters: {},
  loggers: [
    {
      category: ["meoww"],
      lowestLevel: "debug",
      sinks: ["console"],
    },
    {
      category: ["discordeno"],
      lowestLevel: "info",
      sinks: ["console"],
    },
  ],
});

/**
 * The main logger for the application.
 */
export const logger = getLogger(["meoww"]);

/**
 * Creates a sub-logger for a specific module or command.
 */
export function createLogger(name: string) {
  return getLogger(["meoww", name]);
}
