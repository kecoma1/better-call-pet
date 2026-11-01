# Foundation and independent work areas

## Data flow

`React page → services/workspace.ts → Firebase-authenticated HTTP API → domain service → root Firestore collection`.

`Agent or MCP → sharedTools → same domain service`.

Voice calls use `VoiceCall → services/voice.ts → POST /api/voice → GPT-Live WebRTC`
with a trusted server sideband. `functions/src/agent.ts` delegates to the existing gpt-6-luna
conversation adapter in `functions/src/chat.ts` and `sharedTools` for text and delegated voice requests. The browser never
receives a provider key or tool executor. Its data channel can only close or
mute/unmute the call. Firebase identity and active internal membership are required;
membership is checked throughout the call and before tool execution. Calls start
directly, with no product consent/terms flow. The browser manages microphone access.

Audio goes directly over WebRTC; authenticated NDJSON streams the SDP answer,
captions and tool activity from the function. Production uses the function URL
directly because [Firebase Hosting limits rewritten requests to 60 seconds](https://firebase.google.com/docs/hosting/functions).
Calls have an eight-minute server ceiling and end on hang-up, hidden tab,
account change, unmount or connection failure. Media tracks, audio nodes, timers
and sideband connections are cleaned up. Provider session creation is never retried
automatically. No audio recording is stored. Captions remain in the current chat's
memory; reloading clears them. Backend failures are displayed, without demo answers.

The call screen adapts AVEC's 500 ms opacity/vertical text entrances and separate
microphone/assistant audio levels. Reduced motion uses a still and disables reactive
motion. Voice tools retain the existing draft-only accounting boundaries.

The compact phone animation sits above a single chat column. The call reuses the
normal chat messages and tool cards, retaining earlier turns while new speech and
verified tool results arrive in order. Cards appear only for successful tool
executions, rather than showing an always-visible workspace summary. The server
streams these results as each tool completes. On hang-up, messages and cards stay
in the current chat's memory. The chat scrolls while Saul and call controls stay
visible; reading earlier messages pauses automatic scrolling.


Clicking an expense row (overview or receipts) or a ledger row opens the shared `ReceiptSheet` on the right. Rows support Enter/Space and restore keyboard focus when dismissed. Creating a new expense continues to use `ReceiptDialog`; accounting actions and VAT restrictions are shared with the existing posting service.

The overview's Saul banner is the expense notifications area. `src/lib/notifications.ts` derives current work from review-state expenses: missing invoice evidence, VAT reviews, then expenses awaiting approval. `NotificationsBanner` lets users browse these groups and open the relevant expense sheet. Posting updates the banner immediately. These are current-work notifications; there is no push delivery, unread status or notification history yet.

Chat is the default app screen and has a dedicated full-viewport shell. Its own sidebar contains conversation history and an Open workspace action; the dashboard navigation and topbar appear only in accounting sections. The history sidebar becomes an accessible Sheet on mobile. Empty and new conversations show the existing `saul-pacing.webp` walking clip. User questions and assistant replies render with `react-markdown` and `remark-gfm`; tables use shadcn primitives, raw HTML remains escaped, and word fades preserve Markdown semantics.

The Chat sidebar entry and the floating Saul panel share `useConversations` through
one mounted `Chat` owner. Conversation history, topic filtering, search, cards and
tool pills live in `src/pages/chat.tsx` and focused chat components. HTTP requests
live in `src/services/chat.ts`; `functions/src/chat.ts` owns server history,
Decisions topic classification and the Agents SDK adapter. The root
`conversations` collection is private per internal member and denies direct client
access. Agent and MCP still execute the same `sharedTools` registry.

Live chat progress uses the root `chatRuns` collection. The server records bounded public activity and assistant text; `src/services/chat-events.ts` owns the Firestore listener and validates each snapshot. `useConversations` owns its lifecycle. Client rules permit active members to read only their own runs and deny all client writes. The progress writer follows Goals Tracker’s serialized/throttled writes and the UI follows AVEC’s collapsed activity history.

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

Chat loading and pending replies use `saul-desk.webm`: a silent transparent Seedance loop showing Saul writing and reading cases at his desk through five comic pose beats. The clip is six seconds at 15 fps, 416 × 554, with matching first/last frames. `saul-desk.webp` is the infinite animated fallback and `saul-desk.png` is the matching reduced-motion/error still. Video failures are scoped to the source, so a failed scene cannot disable a different loop. Generation details and the exact prompt are in `marketing/chibi/desk-loop.md` and `marketing/chibi/prompts/saul-desk.txt`.

The settings connection scene uses `saul-seated.webm`, a silent transparent VP9 video with a six-second smoking loop. Only the cigar hand and smoke move; the seated lower body stays fixed on the Dots. `saul-seated.webp` is the animated fallback if video playback fails, and `saul-seated.png` is the matching still for reduced motion or failed media. The scene scales as one composition, and the Dots stay stationary on hover so Saul keeps his seat.

`public/chibi/saul-{idle,smoking,thinking,approved,pacing}.webp`: transparent animated WebP, width 416 px, portrait 3:4, infinite seamless loop. The floating chat launcher explicitly uses `smoking`, the relaxed cigar-only clip. The launcher shows only Saul’s animated icon and status dot, without the “Better call Saul” callout. The notifications banner uses `thinking` for pending work and `approved` when caught up, so it never shares the launcher's animation. Inside chat, Saul uses the `pacing` animation in the empty state; messages occupy the conversation area once a question is sent. Each state has its own matching PNG for reduced motion or failed animation loads; errors are scoped to the failed animation. The HTML loader randomly chooses PNG states, with an idle fallback.

Once a normal chat has a message (including the first pending question), a smaller
pacing Saul appears directly above the textarea, outside the scrolling history.

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
