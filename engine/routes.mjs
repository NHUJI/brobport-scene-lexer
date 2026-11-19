import { replayScene } from "./replay.mjs";

/** Explore choice histories in source order, counting each replay against the budget. */
export function exploreRoutes(program, { maxRuns = 1000 } = {}) {
  if (!Number.isSafeInteger(maxRuns) || maxRuns < 1) {
    throw new RangeError("maxRuns must be a positive safe integer");
  }

  const pending = [[]];
  const completed = [];
  const failures = [];
  let runs = 0;

  while (pending.length && runs < maxRuns) {
    const selections = pending.pop();
    runs++;
    let result;
    try {
      result = replayScene(program, selections);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      failures.push({ selections, message: error.message });
      continue;
    }

    if (!result.next) {
      completed.push({ selections, result });
      continue;
    }

    for (const option of result.next.toReversed()) {
      pending.push([...selections, option.key]);
    }
  }

  return { completed, failures, runs, complete: pending.length === 0 };
}
