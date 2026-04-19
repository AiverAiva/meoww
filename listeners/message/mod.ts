import { MessageListener } from "../../types.ts";
import { helloListener } from "./hello.ts";
import { pornhubListener } from "./pornhub.ts";
import { threadsListener } from "./threads.ts";
import { twitterListener } from "./twitter.ts";
import { pixivListener } from "./pixiv.ts";
import { wnacgListener } from "./wnacg.ts";
import { nhentaiListener } from "./nhentai.ts";
import { hanimeListener } from "./hanime.ts";
import { jmcomicListener } from "./jmcomic.ts";
import { latexListener } from "./latex.ts";

export const messageListeners: MessageListener[] = [
  helloListener,
  pornhubListener,
  threadsListener,
  twitterListener,
  pixivListener,
  wnacgListener,
  nhentaiListener,
  latexListener,
  // hanimeListener,
  // jmcomicListener,
];
