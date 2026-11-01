# Foundation and independent work areas

## Data flow

`React page → services/workspace.ts → Firebase-authenticated HTTP API → domain service → root Firestore collection`.

`Agent or MCP → sharedTools → same domain service`.

Voice calls use `VoiceCall → services/voice.ts → POST /api/voice → GPT-Live WebRTC`
with a trusted server sideband. `functions/src/agent.ts` runs the same gpt-6-luna
agent and `sharedTools` for text and delegated voice requests. The browser never
receives a provider key or tool executor. Its data channel can only close or
mute/unmute the call. A verified Firebase identity is required. Internal membership or isolated anonymous demo access
is checked throughout the call and before tool execution. Calls start
directly, with no product consent/terms flow. The browser manages microphone access.

Audio goes directly over WebRTC; authenticated NDJSON streams the SDP answer,
captions and tool activity from the function. Production uses the function URL
directly because [Firebase Hosting limits rewritten requests to 60 seconds](https://firebase.google.com/docs/hosting/functions).
Calls have an eight-minute server ceiling and end on hang-up, hidden tab,
account change, unmount or connection failure. Media tracks, audio nodes, timers
and sideband connections are cleaned up. Provider session creation is never retried
automatically. No audio recording is stored. Captions are saved in the current identity's conversation, including periodic server saves
during calls and a final save on disconnect; reloading restores them. Backend failures are displayed, without demo answers.

The call screen adapts AVEC's 500 ms opacity/vertical text entrances and separate
microphone/assistant audio levels. Reduced motion uses a still and disables reactive
motion. Voice tools retain the existing draft-only accounting boundaries.

Clicking an expense row (overview or receipts) or a ledger row opens the shared `ReceiptSheet` on the right. Rows support Enter/Space and restore keyboard focus when dismissed. Creating a new expense continues to use `ReceiptDialog`; accounting actions and VAT restrictions are shared with the existing posting service.

The overview's Saul banner is the expense notifications area. `src/lib/notifications.ts` derives current work from review-state expenses: missing invoice evidence, VAT reviews, then expenses awaiting approval. `NotificationsBanner` lets users browse these groups and open the relevant expense sheet. Posting updates the banner immediately. These are current-work notifications; there is no push delivery, unread status or notification history yet.

The Google account configured as `INTERNAL_ADMIN_EMAIL` can enroll as the first internal admin. Other accounts require an existing active `/users/{uid}` membership. Revoking membership also blocks OAuth access. The internal company and all its expenses are shared internally. Anonymous demo identities never access those collections.

## Stable boundaries for parallel development

| Area           | Owned files                                                                          | Shared contract                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Shell / design | `src/App.tsx`, `src/style.css`, `src/components/ui/`                                 | Sidebar pages, dark theme variables, stock shadcn components.                                                                       |
| Expenses       | `src/components/receipt-*`, `src/pages/overview.tsx`, `functions/src/tools.ts`       | `ReceiptInput`, `Receipt`, decision provenance and integer-pence journals in `src/domain.ts`. Coordinate edits to that shared file. |
| Chat           | `src/components/chat.tsx`, agent handler in `functions/src/app.ts`                   | `POST /api/chat`; sharedTools registry; gpt-6-luna.                                                                                 |
| OAuth/MCP      | `functions/src/oauth.ts`, MCP handler, `src/pages/connect.tsx`, settings connections | OAuth endpoints and resource `https://rent-o-accountant.web.app/mcp`.                                                               |
| Media          | `public/chibi/`, `marketing/chibi/`, `skills/video-generator/`                       | Filename contract below; app code needs no media-specific changes.                                                                  |
| Reporting      | `src/pages/books.tsx`, `src/pages/reports.tsx`                                       | Read posted expenses; do not invent sales or missing opening balances.                                                              |

Use isolated branches/worktrees for simultaneous work. `App.tsx`, `style.css`, `src/domain.ts`, `functions/src/app.ts` and dependency manifests are coordination points; assign one editor at a time. Do not deploy independently over another agent's version.

## Media contract

The settings connection scene uses `saul-seated.webm`, a silent transparent VP9 video with a six-second smoking loop. Only the cigar hand and smoke move; the seated lower body stays fixed on the Dots. `saul-seated.webp` is the animated fallback if video playback fails, and `saul-seated.png` is the matching still for reduced motion or failed media. The scene scales as one composition, and the Dots stay stationary on hover so Saul keeps his seat.

`public/chibi/saul-{idle,smoking,thinking,approved}.webp`: transparent animated WebP, width 416 px, portrait 3:4, infinite seamless loop. The floating chat launcher explicitly uses `smoking`, the relaxed cigar-only clip. The notifications banner uses `thinking` for pending work and `approved` when caught up, so it never shares the launcher's animation. Inside chat, Saul appears below the messages with `idle`, `thinking` or `approved` according to conversation state. Each state has its own matching PNG for reduced motion or failed animation loads; errors are scoped to the failed animation. The HTML loader randomly chooses PNG states, with an idle fallback.

The voice scene uses its own `saul-phone.webp`: a six-second transparent loop of
Saul talking on a phone, taking short steps left and right. `saul-phone.png` is the
matching still. Source pose and chroma frame live in `marketing/chibi/source/`,
and the motion prompt is `marketing/chibi/prompts/saul-phone.txt`. The pose was
prepared with built-in ImageGen from the approved pacing art; Seedance generates
the video and the existing export pipeline keys the background. Raw video,
provider task metadata and visual QA contact sheets remain ignored under `out/`.

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


## Invoices

`src/pages/invoices.tsx` and `InvoiceDialog` use `services/invoices.ts` through the shared
workspace state. Invoice types live in `src/domain.ts`; shared validation, pence arithmetic,
and immutable draft construction live in `src/lib/invoices.ts`. `src/lib/invoice-pdf.ts` is
the shared PDF layout, loaded on demand for browser demo downloads and run server-side for
live invoices. Company read helpers live in `functions/src/company.ts`.

`functions/src/invoices.ts` owns atomic root `/invoices` and `/invoiceLinks` writes and reads.
HTTP, the gpt-6-luna agent and MCP all use this service. `sharedTools` declares each tool's
OAuth scope explicitly; invoice creation requires `invoices:write`. Public sharing is explicit
in the invoice form and OAuth consent, uses unguessable URLs and exposes only the PDF.
No sales posting or payment transitions are implemented; reports continue to cover expenses.

## Persistent anonymous demo

`src/firebase.ts` restores a separate `demo` Firebase Auth instance and signs in anonymously
when necessary. Google/internal identity takes precedence while signed in; signing out
resumes the same demo identity. Auth or API failures are shown without falling back to local
sample rules. Only an unconfigured development build exposes the labelled offline demo.

`firebaseWorkspaceUser` verifies the Firebase ID token with revocation checks. Anonymous
provider claims construct a server-only `WorkspaceActor`; other identities still require
active internal membership. `workspace-context.ts` maps demo actors to root demo collections
and UID-prefixed document IDs, with workspace-filtered list queries. Clients cannot choose
the scope. `demo.ts` atomically seeds a new demo once with fictional, labelled sample data.
All later mutations, AI decisions, agent tools and voice delegations use the existing services.
`firestore.indexes.json` contains the two filtered demo list indexes; browser writes remain denied.

Company details, receipts, journals and invoices live on the server. Public invoice tokens
resolve to the original workspace and demo invoices carry `demo: true`, including DEMO PDF
markings. OAuth/MCP connections remain internal-only. Demo sessions are not internal members.

`services/conversation.ts` reads and saves the latest 100 messages (5,000 characters each)
through `/api/conversation`. `conversations.ts` stores internal per-member and anonymous
per-session histories in root collections. Voice captions are periodically saved server-side
and appended to chat on hang-up; audio is never retained. Clearing the browser's Firebase
identity makes that demo inaccessible from that browser. Existing offline data stays local;
there is no automatic migration or mixing with server or internal records.
