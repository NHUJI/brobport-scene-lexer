import { lexSceneBody } from "./lexer.mjs";

const scene = `guide: 准备好了吗？ ^a7k2m9qd
@choice ^b3n8x1pe
> 继续 ^c9v4t7rw
  @set ready = true
> 离开 ^d2h6y8ks
  -> end`;

for (const token of lexSceneBody(scene)) console.log(JSON.stringify(token));
