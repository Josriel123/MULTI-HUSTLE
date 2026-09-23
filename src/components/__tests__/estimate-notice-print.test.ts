import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EstimateNotice } from '../EstimateNotice';

/**
 * Second e2e pass, S1: the printed CPA organizer showed the headings
 * "Assumptions this estimate makes (10)" and "Tax items not modeled by this
 * engine (20)" with nothing under them. Browsers do not print the contents of
 * a closed <details>, and paper cannot open one.
 *
 * This checks the markup contract that fixes it — a print-only copy holding
 * every item, and a screen-only <details>. Whether a given browser honours the
 * print styles is a browser question; this pins what the component emits.
 */

const ASSUMPTIONS = ['Filing status defaults to single.', 'Home office use test is assumed met.'];
const NOT_MODELED = ['Tax credits of any kind.', 'State and local income tax.', 'Kiddie tax (Form 8615).'];

function render() {
  return renderToStaticMarkup(
    createElement(EstimateNotice, {
      disclaimer: 'This is an estimate for planning, not tax advice.',
      warnings: [],
      assumptions: ASSUMPTIONS,
      notModeled: NOT_MODELED,
    }),
  );
}

/** The markup of each print-only copy, in document order. */
function printCopies(html: string): string[] {
  return html
    .split('data-print-copy')
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf('</ul>')));
}

describe('EstimateNotice prints its collapsed lists', () => {
  it('emits one print-only copy per collapsible list', () => {
    expect(printCopies(render())).toHaveLength(2);
  });

  it('the print copies contain every assumption and every not-modeled item', () => {
    const [assumptions, notModeled] = printCopies(render());
    for (const a of ASSUMPTIONS) expect(assumptions).toContain(a);
    for (const n of NOT_MODELED) expect(notModeled).toContain(n);
  });

  it('the print copies keep their headings, with the counts', () => {
    const [assumptions, notModeled] = printCopies(render());
    expect(assumptions).toContain('Assumptions this estimate makes (2)');
    expect(notModeled).toContain('Tax items not modeled by this engine (3)');
  });

  it('hides the print copies on screen and the <details> in print', () => {
    const html = render();
    // Each print copy's own element is display:none on screen, block in print.
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\bprint:block\b[^"]*"[^>]*data-print-copy/);
    // Every <details> is hidden when printing, so nothing prints twice.
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(2);
    for (const tag of details) expect(tag).toContain('print:hidden');
  });

  it('drops the card box in print, so a page break cannot leave a stray border', () => {
    const section = render().match(/<section[^>]*>/)?.[0] ?? '';
    expect(section).toContain('print:border-0');
  });

  it('renders no print copy when a list is empty', () => {
    const html = renderToStaticMarkup(
      createElement(EstimateNotice, { disclaimer: 'x', warnings: [], assumptions: [], notModeled: [] }),
    );
    expect(html).not.toContain('data-print-copy');
  });
});
