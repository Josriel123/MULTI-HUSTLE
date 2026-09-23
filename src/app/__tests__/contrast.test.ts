import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND } from '@/lib/brand';

/**
 * Colour contrast, checked on the tokens themselves so no page can drift out
 * of it: WCAG 2.2 AA asks 4.5:1 for text (1.4.3) and 3:1 for the outline of a
 * control and for the focus ring (1.4.11). Every text colour is checked on
 * every surface it can sit on, in both themes, and the coloured ones also on
 * their own 10% tint (badges and chips). The Accessibility statement says this
 * test exists; keep it.
 */

const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--c-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}

/** The first `:root { … }` is the light theme; the one inside the dark media query is the dark theme. */
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf('}', css.indexOf(':root {', darkStart)))) };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `fg` at `alpha` over `bg`, as Tailwind's `bg-accent/10` paints it. */
function tint(fg: string, bg: string, alpha: number): string {
  const f = rgb(fg);
  const b = rgb(bg);
  return '#' + f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, '0')).join('');
}

const TEXT = ['fg', 'fg-muted', 'fg-faint', 'accent', 'danger', 'warning', 'info'];
const SURFACES = ['page', 'surface', 'card'];
const TINTED = ['accent', 'danger', 'warning', 'info'];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme', (_name, t) => {
  it('defines every token the checks use', () => {
    for (const key of [...TEXT, ...SURFACES, 'on-accent', 'on-info', 'field-border']) expect(t[key], key).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(TEXT)('%s text is at least 4.5:1 on every surface', (fg) => {
    for (const bg of SURFACES) expect(ratio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TINTED)('%s text is at least 4.5:1 on its own tint over a card', (fg) => {
    expect(ratio(t[fg], tint(t[fg], t.card, 0.1))).toBeGreaterThanOrEqual(4.5);
  });

  it('button text is at least 4.5:1 on filled buttons', () => {
    expect(ratio(t['on-accent'], t.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t['on-info'], t.info)).toBeGreaterThanOrEqual(4.5);
  });

  it('text boxes and the focus ring are at least 3:1 against what is around them', () => {
    for (const bg of SURFACES) {
      expect(ratio(t['field-border'], t[bg]), `field border on ${bg}`).toBeGreaterThanOrEqual(3);
      expect(ratio(t.accent, t[bg]), `focus ring on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('brand constants', () => {
  it('match the tokens (the theme-color tag, the manifest and the icons cannot read CSS)', () => {
    expect(BRAND.pageLight).toBe(light.page);
    expect(BRAND.pageDark).toBe(dark.page);
    expect(BRAND.accent).toBe(light.accent);
    expect(BRAND.onAccent).toBe(light['on-accent']);
  });
});
