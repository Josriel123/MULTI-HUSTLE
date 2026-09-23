@AGENTS.md

# Claude Code notes

Everything in `AGENTS.md`, imported above, applies — the shared rules live
there because the other agents on this repo read that file, not this one. These
notes are specific to working here as Claude Code.

- **Auto mode refuses some commands as production changes:** `prisma migrate
  deploy`, `git rm`, and scripts that write to the database. Don't work around
  it. Give the owner the exact command, and take read-only before/after counts
  yourself.
- **You can't see signed-in pages with real data.** The preview pane's Clerk
  session doesn't last, and you must not sign in. Check layout and behaviour
  at `/preview/<page>` (sample data through the real engine, D36), verify
  real data through read-only API and database checks, say plainly what was
  not seen, and ask the owner for a click-through.
- **`.claude/launch.json` attaches** to the owner's `npm run dev` on port 3000.
  It never starts a second server — two would fight over `.next`. That server
  keeps the Prisma client it started with: after a schema change it needs a
  restart, which is the owner's.
- **Don't push `master`.** The owner does: `origin/master` may feed a
  deployment.
- **A read-only check against real rows beats a mocked test** for anything that
  compares stored values. The Plaid adoption bug (D22) passed its mocks and
  failed 3 of 15 real rows.
- **Decisions:** a new entry in `docs/decision-log.md`, and in the same commit
  update `README.md` and `AGENTS.md` (shared rules) or this file (Claude-only
  notes) wherever the decision changes what they say.
