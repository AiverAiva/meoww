import { MessageListener } from "../../types.ts";
import { helloListener } from "./hello.ts";
import { pornhubListener } from "./pornhub.ts";

export const messageListeners: MessageListener[] = [
  helloListener,
  pornhubListener,
];
