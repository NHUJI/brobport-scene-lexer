export function fail(token, message) {
  throw new SyntaxError(`${token ? `第 ${token.line} 行` : "正文末尾"}：${message}`);
}
