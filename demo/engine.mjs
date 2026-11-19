import { lexSceneBody } from "../lexer.mjs";

function fail(token, message) {
  throw new SyntaxError(`${token ? `第 ${token.line} 行` : "正文末尾"}：${message}`);
}

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

export function replayScene(program, selections = []) {
  const state = Object.create(null);
  const lines = [];
  const events = [];
  let next = null;
  let used = 0;

  function run(nodes) {
    for (const node of nodes) {
      switch (node.type) {
        case "line":
          lines.push(node.token);
          break;
        case "set":
          state[node.name] = node.value;
          events.push({ line: node.token.line, text: `${node.name} = ${node.value}` });
          break;
        case "if":
          if (!Object.hasOwn(state, node.name)) fail(node.token, `变量 ${node.name} 尚未赋值`);
          if (run(state[node.name] !== node.negate ? node.whenTrue : node.whenFalse)) return true;
          break;
        case "choice": {
          if (used === selections.length) {
            next = node.options;
            return true;
          }
          const selected = selections[used++];
          const option = node.options.find(({ key }) => key === selected);
          if (!option) fail(node.token, "记录中的选项已经不存在");
          events.push({ line: option.line, text: `选择「${option.label}」` });
          if (run(option.body)) return true;
          break;
        }
        case "end":
          return true;
      }
    }
    return false;
  }

  run(program.body);
  if (used < selections.length) throw new Error("记录包含未执行的选项");
  return { state, lines, events, next };
}

export function findDependencyCycle(steps) {
  const finished = new Set();
  const active = new Set();
  const path = [];

  function visit(step) {
    if (active.has(step)) return [...path.slice(path.indexOf(step)), step];
    if (finished.has(step)) return null;
    if (!Object.hasOwn(steps, step)) throw new Error(`找不到依赖步骤 ${step}`);

    active.add(step);
    path.push(step);
    for (const dependency of steps[step]) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    active.delete(step);
    finished.add(step);
    return null;
  }

  for (const step of Object.keys(steps)) {
    const cycle = visit(step);
    if (cycle) return cycle;
  }
  return null;
}
