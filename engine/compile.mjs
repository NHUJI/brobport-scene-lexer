import { lexSceneBody } from "../lexer.mjs";
import { fail } from "./diagnostics.mjs";

export function compileScene(source) {
  const tokens = lexSceneBody(source);
  const ids = new Set();
  for (const token of tokens) {
    if (token.id && ids.has(token.id)) fail(token, `重复 ID ${token.id}`);
    if (token.id) ids.add(token.id);
  }

  let index = 0;
  const peek = () => tokens[index];

  function block(indent, stops = []) {
    const nodes = [];
    while (peek() && peek().indent >= indent) {
      const token = peek();
      if (token.indent !== indent) fail(token, "当前行的缩进没有对应的选项");
      if (stops.includes(token.text)) break;
      index++;

      if (token.kind === "dialogue" || token.kind === "narration") {
        nodes.push({ type: "line", token });
      } else if (token.kind === "choice" && token.text === "@choice") {
        const options = [];
        while (peek()?.kind === "option" && peek().indent === indent) {
          const option = tokens[index++];
          options.push({
            key: option.id ?? String(option.line),
            label: option.text.slice(2),
            line: option.line,
            body: block(indent + 2),
          });
        }
        if (!options.length) fail(token, "@choice 至少需要一个 > 选项");
        nodes.push({ type: "choice", token, options });
      } else if (token.text.startsWith("@if ")) {
        const condition = /^@if (?:(not) )?([a-z][a-z0-9_]*)$/.exec(token.text);
        if (!condition) fail(token, "条件可写成 @if flag 或 @if not flag");
        const whenTrue = block(indent, ["@else", "@end"]);
        let whenFalse = [];
        if (peek()?.text === "@else" && peek().indent === indent) {
          index++;
          whenFalse = block(indent, ["@end"]);
        }
        if (peek()?.text !== "@end" || peek().indent !== indent) fail(token, "@if 缺少同级的 @end");
        index++;
        nodes.push({ type: "if", token, name: condition[2], negate: Boolean(condition[1]), whenTrue, whenFalse });
      } else if (token.text.startsWith("@set ")) {
        const assignment = /^@set ([a-z][a-z0-9_]*) = (true|false)$/.exec(token.text);
        if (!assignment) fail(token, "状态赋值可写成 @set flag = true 或 false");
        nodes.push({ type: "set", token, name: assignment[1], value: assignment[2] === "true" });
      } else if (token.text === "-> end") {
        nodes.push({ type: "end" });
      } else {
        fail(token, `演示语法无法执行 ${token.text}`);
      }
    }
    return nodes;
  }

  if (!tokens.length) fail(null, "请先写几行剧本");
  return { tokens, body: block(0) };
}
