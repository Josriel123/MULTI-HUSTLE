import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Where sign-in is checked (D53). The proxy checks nothing: a list of paths
 * there can drift from how Next routes a request and leave something
 * reachable, which is why Clerk deprecated createRouteMatcher. So every
 * handler checks for itself, and the app's pages are protected by their
 * layout. These are source checks: they fail when a new API route forgets
 * its check, or when path-based protection creeps back into the proxy.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

// Authenticated another way: Clerk signs its webhooks (Svix), and the route verifies the signature.
const SIGNED_BY_SENDER = new Set(['src/app/api/webhooks/clerk/route.ts']);

describe('auth boundaries', () => {
  it('the proxy protects nothing by path', () => {
    // Code only: the file's comments explain why these are gone.
    const code = read('src/proxy.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/createRouteMatcher/);
    expect(code).not.toMatch(/auth\.protect\(/);
  });

  it('the app layout stops signed-out page loads, on the server and in the browser', () => {
    const layout = read('src/app/(app)/layout.tsx');
    expect(layout).toMatch(/await auth\.protect\(\)/);
    expect(layout).toMatch(/<SignedOutRedirect\s*\/>/);
  });

  it('every API route handler checks who is asking', () => {
    const files = routeFiles(join(root, 'src', 'app', 'api')).map((f) => relative(root, f).replace(/\\/g, '/'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      if (SIGNED_BY_SENDER.has(file)) continue;
      const source = read(file);
      const handlers = source.match(/^export (async )?function (GET|POST|PUT|PATCH|DELETE)\b/gm) ?? [];
      const checks = source.match(/\b(auth|requireUser)\(\)/g) ?? [];
      expect(handlers.length, file).toBeGreaterThan(0);
      expect(checks.length, `${file}: ${handlers.length} handlers, ${checks.length} sign-in checks`).toBeGreaterThanOrEqual(handlers.length);
    }
  });

  it('the Clerk webhook verifies its signature instead', () => {
    expect(read('src/app/api/webhooks/clerk/route.ts')).toMatch(/verifyWebhook|Webhook\(|svix/i);
  });
});
