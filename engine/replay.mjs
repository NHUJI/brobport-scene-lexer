import { fail } from "./diagnostics.mjs";

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
