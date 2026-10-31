/** UTF-16 code unit order. Stable across machines, unlike localeCompare. */
export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
