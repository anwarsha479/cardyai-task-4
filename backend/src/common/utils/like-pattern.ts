/** `ILIKE` pattern that matches `search` anywhere, with `%`, `_` and `\` taken literally. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
