/**
 * What a money field sends to the server.
 *
 * People type "$1,200.50". The server accepts only a plain decimal and
 * refuses anything else (src/lib/validation.ts: refuse, never correct). Two
 * things are removed here because they cannot change the meaning: a leading
 * dollar sign and US thousands separators in the right places. Anything
 * ambiguous ("1.200,50", "1,20") is passed through untouched, so the server
 * refuses it with a message instead of this guessing.
 */
export function normalizeMoneyText(input: string): string {
  let text = input.trim();
  if (text.startsWith('$')) text = text.slice(1).trim();
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(text)) text = text.replace(/,/g, '');
  return text;
}
