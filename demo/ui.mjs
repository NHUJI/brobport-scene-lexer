import { compileScene, findDependencyCycle, replayScene } from "./engine.mjs";

const example = `*核验台等待输入。* ^n4f8m1rw
@set verified = false
guide: 要核验这条记录吗？ ^a7k2m9qd

@choice ^b3n8x1pe
> 核验记录 ^c9v4t7rw
  @set verified = true
> 跳过核验 ^d2h6y8ks

@if verified
guide: 核验通过，记录已提交。 ^e5j1u3zl
@else
guide: 记录已保存，等待复核。 ^f6w2t8nz
@end`;

const $ = (id) => document.getElementById(id);
const source = $("source");
const highlight = $("highlight");
let program = null;
let selections = [];

function element(tag, text, className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function alignHighlight() {
  highlight.scrollTop = source.scrollTop;
  highlight.scrollLeft = source.scrollLeft;
}

function paintSource() {
  highlight.replaceChildren();
  source.value.split("\n").forEach((line, index) => {
    const number = element("span", String(index + 1), "line-number");
    const suffix = / +\^[a-z][a-z0-9]{7}$/.exec(line);
    const text = suffix ? line.slice(0, suffix.index) : line;
    const kind = { "@": "directive", ">": "option", "*": "narration", "/": "narration" }[text.trimStart()[0]];
    highlight.append(number, element("span", text, kind));
    if (suffix) highlight.append(element("span", suffix[0], "source-id"));
    highlight.append("\n");
  });
  alignHighlight();
}

function showView(tokensVisible) {
  $("source-tab").setAttribute("aria-pressed", !tokensVisible);
  $("tokens-tab").setAttribute("aria-pressed", tokensVisible);
  $("source-pane").hidden = tokensVisible;
  $("tokens-pane").hidden = !tokensVisible;
  if (!tokensVisible) alignHighlight();
}

function showTokens(tokens) {
  $("token-count").textContent = tokens.length || "";
  $("tokens").replaceChildren(...tokens.map((token) => {
    const row = element("tr", "");
    for (const value of [token.line, token.kind, token.indent, token.id ?? "—", token.text]) {
      row.append(element("td", value));
    }
    return row;
  }));
}

function showRun(result, message) {
  const status = $("run-status");
  status.textContent = message ?? (result?.next ? "等待选择" : "本场结束");
  status.dataset.phase = result?.next ? "waiting" : result ? "done" : "idle";
  $("restart").disabled = !program || !selections.length;
  $("replay").disabled = !result || !selections.length;

  $("transcript").replaceChildren(...(result?.lines ?? []).map((token) => {
    if (token.kind === "narration") return element("p", token.text.replace(/^\*|\*$/g, ""), "narration-line");
    const [, speaker, text] = /^("[^"]+"|[a-z][a-z0-9_]*)(?:\([^)]*\))?: (.*)$/.exec(token.text);
    const line = element("div", "", "dialogue-line");
    line.append(element("span", speaker.replace(/^"|"$/g, ""), "speaker"), element("p", text));
    return line;
  }));

  $("options").replaceChildren(...(result?.next ?? []).map((option) => {
    const button = element("button", option.label, "option-button");
    button.type = "button";
    button.append(element("span", "→"));
    button.lastElementChild.setAttribute("aria-hidden", "true");
    button.addEventListener("click", () => {
      selections.push(option.key);
      play();
      $("playhead").focus({ preventScroll: true });
    });
    return button;
  }));

  const state = Object.entries(result?.state ?? {}).map(([key, value]) => {
    const variable = element("code", `${key} = `, "variable");
    variable.append(element("strong", String(value), value ? "is-true" : ""));
    return variable;
  });
  $("state").replaceChildren(...(state.length ? state : [element("span", "暂无变量", "muted")]));
  $("events").replaceChildren(...(result?.events ?? []).map(({ line, text }) => {
    const row = element("li", "");
    row.append(element("code", `L${line}`), element("span", text));
    return row;
  }));
}

function play(message) {
  try {
    showRun(replayScene(program, selections), message);
  } catch (error) {
    showRun(null, `执行出错 · ${error.message}`);
  }
}

function setCompileStatus(message, mode) {
  $("compile-status").textContent = message;
  $("compile-status").dataset.mode = mode;
}

function compile() {
  selections = [];
  try {
    program = compileScene(source.value);
    showTokens(program.tokens);
    setCompileStatus(`编译成功 · ${program.tokens.length} 个 token`, "ok");
    play();
  } catch (error) {
    program = null;
    showTokens([]);
    showView(false);
    setCompileStatus(error.message, "error");
    showRun(null, "修正剧本后重新编译");
  }
}

function restore() {
  source.value = example;
  showView(false);
  paintSource();
  source.scrollTop = 0;
  source.scrollLeft = 0;
  alignHighlight();
  compile();
}

function checkDependencies(cyclic) {
  const steps = { collect: cyclic ? ["resolve"] : [], verify: ["collect"], resolve: ["verify"] };
  const cycle = findDependencyCycle(steps);
  $("acyclic").setAttribute("aria-pressed", !cyclic);
  $("cyclic").setAttribute("aria-pressed", cyclic);
  $("dependency-source").textContent = ["steps:", ...Object.entries(steps).map(([id, after]) => (
    `  - { id: ${id}, after: [${after.join(", ")}] }`
  ))].join("\n");
  $("dependency-result").dataset.result = cycle ? "cycle" : "ok";
  $("dependency-title").textContent = cycle ? "检测到依赖环" : "依赖检查通过";
  $("dependency-path").textContent = cycle ? cycle.join(" → ") : "collect → verify → resolve";
  $("dependency-note").textContent = cycle
    ? "箭头表示「等待」。沿 after 回到 collect，没有一步可以先开始。"
    : "箭头表示执行顺序。collect 无需等待，可以先开始。";
}

source.addEventListener("input", () => {
  paintSource();
  setCompileStatus("有未编译的更改", "draft");
});
source.addEventListener("scroll", alignHighlight);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    compile();
  }
});
$("compile").addEventListener("click", compile);
$("restore").addEventListener("click", restore);
$("source-tab").addEventListener("click", () => showView(false));
$("tokens-tab").addEventListener("click", () => showView(true));
$("restart").addEventListener("click", () => { selections = []; play(); });
$("replay").addEventListener("click", () => play(`已重放 ${selections.length} 次选择`));
$("acyclic").addEventListener("click", () => checkDependencies(false));
$("cyclic").addEventListener("click", () => checkDependencies(true));

restore();
checkDependencies(false);
