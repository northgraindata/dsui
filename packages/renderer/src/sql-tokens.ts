/** Small lexical highlighter used while the full editor is unavailable. Never rewrites SQL. */
export function sqlTokens(sql: string): { text: string; kind: string }[] {
  const pattern =
    /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b(?:SELECT|FROM|WHERE|GROUP|BY|ORDER|ASC|DESC|LIMIT|AS|AND|OR|NOT|NULL|JOIN|LEFT|RIGHT|INNER|ON|WITH|INSERT|INTO|VALUES|CREATE|TABLE|SCHEMA|UPDATE|SET|DELETE|DISTINCT|HAVING|CASE|WHEN|THEN|ELSE|END|DATE|TIMESTAMP)\b|\b(?:COUNT|SUM|AVG|MIN|MAX|COALESCE|ROUND)\b|\b\d+(?:\.\d+)?\b)/gi;
  const tokens: { text: string; kind: string }[] = [];
  let cursor = 0;
  for (const match of sql.matchAll(pattern)) {
    if (match.index > cursor)
      tokens.push({ text: sql.slice(cursor, match.index), kind: "plain" });
    const text = match[0];
    const kind =
      text.startsWith("--") || text.startsWith("/*")
        ? "comment"
        : text.startsWith("'")
          ? "string"
          : text.startsWith('"')
            ? "plain"
            : /^\d/.test(text)
              ? "number"
              : /^(COUNT|SUM|AVG|MIN|MAX|COALESCE|ROUND)$/i.test(text)
                ? "function"
                : "keyword";
    tokens.push({ text, kind });
    cursor = match.index + text.length;
  }
  if (cursor < sql.length)
    tokens.push({ text: sql.slice(cursor), kind: "plain" });
  return tokens;
}
