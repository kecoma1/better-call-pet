# Better Call Pet

The current objective is an internal **expenses foundation**, not a complete UK tax filing product. Respect the shared data model and contracts in `docs/`. Read relevant repository skills before modifying a feature.

- React 19, TypeScript, Vite, shadcn/ui, dark-only. UI primitives live in `src/components/ui/` and retain stock APIs.
- `src/services/` owns HTTP requests. Components do not call fetch or Firestore.
- `src/domain.ts` is shared by client and server; amounts are integer pence. Never introduce floating-point monetary storage.
- Firebase project `rent-o-accountant`, region `europe-west2`. All data collections are root-level. `/users` holds internal membership; do not put accounting data under users.
- `functions/src/index.ts` exports the Firebase trigger; `app.ts` holds HTTP composition; domain logic, schemas and OAuth are separate modules.
- Agent and Decisions model: `gpt-6-luna`. Agent and MCP use `sharedTools`; do not duplicate business logic. All provider calls stay server-side.
- Server validates identity, internal membership and OAuth scopes. Client rules deny direct writes. No secrets, real receipts or private email addresses in Git or fixtures.
- Posting is explicit, atomic and idempotent. Draft creation must never post automatically. Needs-review decisions cannot be posted.
- Browser-only sample rules are labelled demo. Never silently substitute them for failed live OpenAI calls.
- Do not claim annual accounts, CT600, iXBRL, VAT filing, bank reconciliation, accepted submissions or completed payments until actually implemented and tested.
- Videos are a separate work area: asset agents own `public/chibi/` and `marketing/chibi/`; app agents consume the filename contract in `docs/architecture.md`.

Before committing: `npm test`, `npm run build`, `npm --prefix functions run build`, and affected Playwright scenarios. Add tests for new domain/permission/state-transition behaviour. Keep package lockfiles tracked. Use `codex/` for subsequent branches, and coordinate shared files before parallel edits.
