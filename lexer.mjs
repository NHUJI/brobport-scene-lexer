const lineKinds = [
  ["choice", /^@choice(?: |$)/],
  ["command", /^@[a-z_]+/],
  ["option", /^> /],
  ["variant", /^\| /],
  ["jump", /^-> /],
  ["label", /^# /],
  ["narration", /^\*/],
  ["dialogue", /^(?:[a-z][a-z0-9_]*|"[^"]+")(?:\([^)]*\))?: /],
];

export function lexSceneBody(source) {
  const tokens = [];

  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = index + 1;
    if (raw.includes("\t")) throw new SyntaxError(`第 ${line} 行含 Tab`);

    const content = raw.trim();
    if (!content || content.startsWith("//")) continue;

    const indent = raw.match(/^ */)[0].length;
    if (indent % 2 !== 0) throw new SyntaxError(`第 ${line} 行缩进应为两格的倍数`);

    const suffix = / +\^([a-z][a-z0-9]{7})$/.exec(content);
    const text = suffix ? content.slice(0, suffix.index) : content;
    const rule = lineKinds.find(([, pattern]) => pattern.test(text));
    if (!rule) throw new SyntaxError(`第 ${line} 行无法识别`);

    tokens.push({ kind: rule[0], text, line, indent, id: suffix?.[1] ?? null });
  }

  return tokens;
}
