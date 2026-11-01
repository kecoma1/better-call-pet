# Better Call Pet

A dark-only, internal expenses workspace for a UK LTD, with Saul Goodman as its accounting companion. Built at the DevDay Exchange Community Hackathon, London, 1 November 2026.

**Core journey:** add a GBP receipt → review extracted fields → classify input VAT → inspect the proposed journal → approve and post once → export the ledger. The public demo uses fictional receipts and clearly labelled illustrative rules. Live data requires an authorised Google account.

## Run locally

Requires Node 22 and npm. Firebase project: `rent-o-accountant`.

```bash
npm ci
npm --prefix functions ci
cp .env.example .env
# Fill the public VITE_FIREBASE_* fields in .env.local, not server secrets.
# Put OPENAI_API_KEY in .env, never in a VITE_ variable.
npm run dev
```

The frontend runs at http://localhost:5173. Its demo works without credentials and stores only fictional data in this browser. `npm run build` produces `dist/`.

For the live backend, create `functions/.env.rent-o-accountant` with `INTERNAL_ADMIN_EMAIL=your-authorised-google-email` and set `OPENAI_API_KEY` in Firebase Secret Manager. For the Functions emulator, put `OPENAI_API_KEY` in `functions/.secret.local` (ignored), then run:

```bash
npm --prefix functions run build
firebase emulators:start --only functions,firestore,auth
```

The frontend currently uses live Firebase Auth unless explicitly pointed at an emulator; use the deployed Firebase Hosting origin for the live Google sign-in journey. For a full local emulator journey, connect Auth to port 9099 in `src/firebase.ts` and add localhost to Firebase's authorised domains. Never point tests with synthetic fixtures at the production database.

```bash
npm test
npm run build
npm --prefix functions run build
npm run test:e2e
```

For E2E, install Chromium with `npx playwright install chromium`, or use an existing Chrome installation with `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

## Architecture

React + TypeScript + Vite, shadcn/ui + Tailwind, Firebase Auth/Firestore/Functions/Hosting. All network calls pass through `src/services/` and the authenticated server. OpenAI keys never reach the browser.

Firestore uses **root collections**, shared by authorised internal users:

| Collection                                                                      | Purpose                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `users`                                                                         | Internal membership; `active` controls access.                        |
| `companies/primary`                                                             | Shared LTD configuration.                                             |
| `expenses`                                                                      | Receipt fields, decision provenance, review/post state, creator.      |
| `journals`                                                                      | Balanced entries, one deterministic document per expense.             |
| `aiUsage`                                                                       | Per-member daily AI request count.                                    |
| `oauthClients`, `oauthCodes`, `oauthAccess`, `oauthRefresh`, `oauthConnections` | OAuth registration, short-lived grants, hashed tokens and revocation. |

The initial admin email is configured privately on the server. That verified Google account is enrolled in `users` on first API access; additional members must be provisioned by an administrator. The client cannot edit membership or accounting records directly.

See [architecture and work boundaries](docs/architecture.md) and [HTTP/tool contracts](docs/contracts.md) before extending a module. Repository skills are in `skills/`, with discoverable copies in `.agents/skills/`.

## OpenAI and MCP

- **Agents SDK:** `gpt-6-luna` powers Saul, with tools for company details, expense listing and draft creation.
- **Decisions API:** `POST /v1/decisions`, model `gpt-6-luna`, typed choices `deductible`, `not_deductible`, `review`. This is a suggestion; missing evidence and special rules require review.
- **Receipt extraction:** Responses API structured output, with nullable missing fields. GBP images only in this foundation; PNG/JPG/WebP below 4.5 MB.
- **MCP:** the same tool registry is exposed at `/mcp` using stateless Streamable HTTP. OAuth discovery, dynamic client registration, browser consent, S256 PKCE, resource-bound access tokens, refresh rotation and revocation are implemented. No API keys are pasted into chats. Your Dot must support remote MCP and OAuth. The UI intentionally gives a connection guide rather than inventing a client-specific deep link.

MCP URL: `https://rent-o-accountant.web.app/mcp`. Posting is deliberately a UI action, unavailable to agent tools. OAuth integration needs an end-to-end check with the actual Dot client before it can be considered verified.

## Scope of this foundation

Expenses are the complete first journey. Bookkeeping exports cover purchase journals and a trade-creditor balance; payment matching and bank reconciliation are future work. The annual accounts, Corporation Tax and VAT sections are **incomplete internal working papers**, with the declaration lifecycle shown for future implementation. They do not calculate a complete tax return, generate CT600/iXBRL, submit anything, or assert acceptance/payment.

Invoice images are processed for extraction/classification but are not retained by this version. Retain original invoices separately until document storage is implemented. Demo/live workspaces are kept separate. More than 500 expenses needs pagination, which is a follow-up task.

## Deploy

```bash
firebase functions:secrets:set OPENAI_API_KEY --project rent-o-accountant
npm run build
firebase deploy --only hosting,functions:better-call-pet,firestore:rules --project rent-o-accountant
```

Google sign-in must be enabled, the hosting domain authorised, Firestore created, and billing enabled for Functions. Review existing project rules before replacing them. This repo's rules deny client writes and OAuth collection reads.

## Demo outline (under 90 seconds)

1. Explain the problem: a small LTD registers an expense once.
2. Add the fictional Paper & Co. receipt, show the VAT suggestion and HMRC source.
3. Review the journal and post it; open the ledger and export.
4. Show blocked VAT on client entertainment.
5. Open Saul's chat, then the OAuth connection guide.

No real invoices, account identifiers or secrets in recordings. A demo video is a follow-up deliverable, not yet included in this foundation.

## Credits and sources

- Codex scaffolded the React/Firebase architecture, the shared Agents/MCP tool registry and the expenses verification suite. See the commit history for concrete implementation evidence.
- shadcn/ui primitives and sidebar behaviour were reused from the owner's `rent-o-crm` project and adapted to this app. shadcn/ui and Radix are MIT-licensed; dependencies retain their own licences.
- `skills/reactjs-code` and `skills/cloud-functions` come from [kecoma1/skills](https://github.com/kecoma1/skills), source commit `125058ad267651dedd3ed8ed5f87c6434c5b1dda`.
- The video generation scripts were reused from the owner's Goals-tracker project; they use BytePlus Seedance. Saul's still was created with OpenAI ImageGen during this session. Character fan art; no affiliation with the show's rights holders. Animation assets are being handled separately.
- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk), [Decisions API](https://developers.openai.com/api/docs/guides/decisions), [Codex quickstart](https://developers.openai.com/codex/quickstart), [Cookbook](https://developers.openai.com/cookbook).
- [HMRC: reclaiming VAT on business expenses](https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses), [VAT registration](https://www.gov.uk/register-for-vat), [business entertainment](https://www.gov.uk/guidance/business-entertainment-and-vat-notice-70065). Rules need professional review before real tax filing.
- [MCP authorisation](https://modelcontextprotocol.io/specification/latest/basic/authorization), [Firebase Functions](https://firebase.google.com/docs/functions/get-started), [hackathon](https://luma.com/dde-ldn-hack).
