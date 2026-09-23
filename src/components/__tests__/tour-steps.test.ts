import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV_GROUPS } from '../SidebarNav';
import { TOUR_STEPS } from '../tour/tourSteps';

/**
 * The guided tour points at elements by their `data-tour` name. A renamed tab
 * or a moved tax-year picker would leave a step pointing at nothing, which
 * the tour survives (it centres the bubble) but explains the wrong thing. So:
 * every tab has a step, every step's target exists, and the steps that open
 * the phone menu are exactly the tabs the bottom bar does not show.
 */

const appShell = readFileSync(join(process.cwd(), 'src', 'components', 'AppShell.tsx'), 'utf8');
const navHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
/** The tabs in the phone's bottom bar: `tab('/report', …)` in AppShell. */
const bottomTabs = [...appShell.matchAll(/\btab\('([^']+)'/g)].map((m) => m[1]);

describe('guided tour steps', () => {
  it('explains every tab in the menu', () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    for (const href of navHrefs) expect(targets, href).toContain(`nav-${href}`);
  });

  it('points only at elements that exist', () => {
    for (const step of TOUR_STEPS) {
      if (!step.target) continue;
      if (step.target.startsWith('nav-')) expect(navHrefs, step.id).toContain(step.target.slice(4));
      else expect(appShell, step.id).toContain(`data-tour="${step.target}"`);
    }
  });

  it('opens the phone menu for exactly the tabs the bottom bar does not show', () => {
    expect(bottomTabs.length).toBeGreaterThanOrEqual(3);
    for (const step of TOUR_STEPS.filter((s) => s.target?.startsWith('nav-'))) {
      const inBottomBar = bottomTabs.includes(step.target!.slice(4));
      expect(Boolean(step.drawer), step.id).toBe(!inBottomBar);
    }
  });

  it('keeps each bubble short, with unique ids', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    for (const step of TOUR_STEPS) {
      expect(step.title.length, step.id).toBeGreaterThan(0);
      expect(step.body.length, step.id).toBeLessThanOrEqual(200);
    }
  });
});
