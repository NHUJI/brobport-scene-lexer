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
