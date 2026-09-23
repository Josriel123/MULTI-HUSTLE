/**
 * The first thing a keyboard user reaches: jumps past the navigation to the
 * page's `<main id="main">`. Invisible until focused (WCAG 2.4.1, bypass blocks).
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-pop transition-transform focus:translate-y-0 print:hidden"
    >
      Skip to main content
    </a>
  );
}
