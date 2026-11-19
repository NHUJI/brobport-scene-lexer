import assert from "node:assert/strict";
import { test } from "node:test";
import { lexSceneBody } from "../lexer.mjs";
import { compileScene, exploreRoutes, findDependencyCycle, replayScene } from "../engine/index.mjs";

const scene = `@set ready = false
@choice ^choice01
> Continue ^option01
  @set ready = true
> Leave ^option02
  -> end
@if ready
guide: Ready. ^line0001
@end`;

test("lexer preserves source positions and stable IDs across CRLF and comments", () => {
  assert.deepEqual(lexSceneBody("// note\r\n\r\n  > Continue ^option01"), [
    { kind: "option", text: "> Continue", line: 3, indent: 2, id: "option01" },
  ]);
  assert.throws(() => lexSceneBody("\t@choice"), /第 1 行/);
});

test("compiler locates invalid nesting and duplicate IDs", () => {
  assert.throws(() => compileScene("@choice\nguide: Stop."), /第 1 行.*至少/);
  assert.throws(() => compileScene("@if ready\nguide: Ready."), /第 1 行.*缺少/);
  assert.throws(() => compileScene("guide: A ^line0001\nguide: B ^line0001"), /第 2 行.*重复/);
});

test("replay applies the selected branch without sharing state across runs", () => {
  const program = compileScene(scene);
  assert.deepEqual(replayScene(program).next.map(({ key }) => key), ["option01", "option02"]);
  const continued = replayScene(program, ["option01"]);
  assert.equal(continued.state.ready, true);
  assert.equal(continued.lines[0].id, "line0001");
  assert.deepEqual(replayScene(program, ["option01"]), continued);
  const left = replayScene(program, ["option02"]);
  assert.equal(left.state.ready, false);
  assert.deepEqual(left.lines, []);
  assert.throws(() => replayScene(program, ["outdated"]), /已经不存在/);
  assert.throws(() => replayScene(program, ["option02", "option01"]), /未执行/);
});

test("nested choices resume the enclosing block and preserve decision order", () => {
  const program = compileScene(`@choice
> Outer ^option01
  @choice
  > Inner ^option02
    guide: Inside.
guide: Outside.`);
  assert.equal(replayScene(program, ["option01"]).next[0].key, "option02");
  const result = replayScene(program, ["option01", "option02"]);
  assert.deepEqual(result.lines.map(({ text }) => text), ["guide: Inside.", "guide: Outside."]);
});

test("route exploration distinguishes failure, completion, and budget exhaustion", () => {
  const program = compileScene(`@choice
> Good ^option01
  -> end
> Bad ^option02
@if missing
guide: Unreachable.
@end`);
  const full = exploreRoutes(program);
  assert.equal(full.complete, true);
  assert.equal(full.runs, 3);
  assert.deepEqual(full.completed.map(({ selections }) => selections), [["option01"]]);
  assert.deepEqual(full.failures.map(({ selections }) => selections), [["option02"]]);
  assert.match(full.failures[0].message, /尚未赋值/);
  const partial = exploreRoutes(program, { maxRuns: 2 });
  assert.equal(partial.complete, false);
  assert.equal(partial.completed.length, 1);
  assert.deepEqual(partial.failures, []);
  assert.throws(() => exploreRoutes(program, { maxRuns: 0 }), RangeError);
});

test("dependency checker handles shared prerequisites, cycles, and missing references", () => {
  assert.equal(findDependencyCycle({ a: ["b", "c"], b: ["c"], c: [] }), null);
  assert.deepEqual(findDependencyCycle({ root: ["a"], a: ["b"], b: ["a"] }), ["a", "b", "a"]);
  assert.deepEqual(findDependencyCycle({ a: ["a"] }), ["a", "a"]);
  assert.throws(() => findDependencyCycle({ a: ["missing"] }), /missing/);
});
