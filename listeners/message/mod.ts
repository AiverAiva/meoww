import { MessageListener } from "../../types.ts";
import { helloListener } from "./hello.ts";

export const messageListeners: MessageListener[] = [
  helloListener,
];
