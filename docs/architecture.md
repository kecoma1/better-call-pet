# Foundation and independent work areas

## Data flow

`React page → services/workspace.ts → Firebase-authenticated HTTP API → domain service → root Firestore collection`.

`Agent or MCP → sharedTools → same domain service`.

Clicking an expense row (overview or receipts) or a ledger row opens the shared `ReceiptSheet` on the right. Rows support Enter/Space and restore keyboard focus when dismissed. Creating a new expense continues to use `ReceiptDialog`; accounting actions and VAT restrictions are shared with the existing posting service.

The overview's Saul banner is the expense notifications area. `src/lib/notifications.ts` derives current work from review-state expenses: missing invoice evidence, VAT reviews, then expenses awaiting approval. `NotificationsBanner` lets users browse these groups and open the relevant expense sheet. Posting updates the banner immediately. These are current-work notifications; there is no push delivery, unread status or notification history yet.

The Chat sidebar entry opens the full conversation screen. A single mounted `Chat`
owner retains `useConversations` state while other sections are visible, preserving
unsent text and in-flight requests without rendering a floating launcher.
Conversation history, topic filtering, search, cards and
tool pills live in `src/pages/chat.tsx` and focused chat components. HTTP requests
live in `src/services/chat.ts`; `functions/src/chat.ts` owns server history,
Decisions topic classification and the Agents SDK adapter. The root
`conversations` collection is private per internal member and denies direct client
access. Agent and MCP still execute the same `sharedTools` registry.

The Google account configured as `INTERNAL_ADMIN_EMAIL` can enroll as the first internal admin. Other accounts require an existing active `/users/{uid}` membership. Revoking membership also blocks OAuth access. The company and all expenses are shared internally.

## Stable boundaries for parallel development

| Area           | Owned files                                                                          | Shared contract                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Shell / design | `src/App.tsx`, `src/style.css`, `src/components/ui/`                                 | Sidebar pages, dark theme variables, stock shadcn components.                                                                       |
| Expenses       | `src/components/receipt-*`, `src/pages/overview.tsx`, `functions/src/tools.ts`       | `ReceiptInput`, `Receipt`, decision provenance and integer-pence journals in `src/domain.ts`. Coordinate edits to that shared file. |
| Chat           | `src/components/chat*`, `src/pages/chat.tsx`, `functions/src/chat.ts`                | `POST /api/chat`; sharedTools registry; gpt-6-luna.                                                                                 |
| OAuth/MCP      | `functions/src/oauth.ts`, MCP handler, `src/pages/connect.tsx`, settings connections | OAuth endpoints and resource `https://rent-o-accountant.web.app/mcp`.                                                               |
| Media          | `public/chibi/`, `marketing/chibi/`, `skills/video-generator/`                       | Filename contract below; app code needs no media-specific changes.                                                                  |
| Reporting      | `src/pages/books.tsx`, `src/pages/reports.tsx`                                       | Read posted expenses; do not invent sales or missing opening balances.                                                              |

Use isolated branches/worktrees for simultaneous work. `App.tsx`, `style.css`, `src/domain.ts`, `functions/src/app.ts` and dependency manifests are coordination points; assign one editor at a time. Do not deploy independently over another agent's version.

## Media contract

`public/chibi/saul-{idle,smoking,thinking,approved}.webp`: transparent animated WebP, width 416 px, portrait 3:4, infinite seamless loop. The notifications banner uses `thinking` for pending work and `approved` when caught up. The `smoking` clip remains available as a media asset. Inside chat, Saul appears below the messages with `idle`, `thinking` or `approved` according to conversation state. Each state has its own matching PNG for reduced motion or failed animation loads; errors are scoped to the failed animation. The HTML loader randomly chooses PNG states, with an idle fallback.

Seedance cigar source generation already exists at `marketing/chibi/out/saul-cigar.mp4` in the shared working directory (ignored). Preserve the original approved character art. Generated task metadata can contain signed URLs and must stay ignored.

## Current limitations to tackle explicitly

- Wire and test full Auth/Firestore emulator mode.
- Add expense editing, manual resolution with an audit trail, and revalidation when company VAT details change.
- Persist original receipts in private object storage; no originals are retained yet.
- Add payment state and bank reconciliation without treating invoice posting as payment.
- Paginate beyond 500 expenses.
- Finish OAuth interoperability tests with the actual Dot client; current implementation supports registered callbacks and DCR, not client metadata documents.
- Add tax-period selection and validated reporting only after the expense flow is solid.
- Media and a short recorded demo are separate deliverables.
