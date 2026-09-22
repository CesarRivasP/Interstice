// The beacon transport does not exist under jest; the lines themselves are not
// what the app tests assert on.
export const lines: string[] = [];
export function log(line: string): void {
  lines.push(line);
}
