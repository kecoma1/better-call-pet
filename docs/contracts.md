# HTTP and tool contracts

All `/api/*` routes except `/api/health` require a Firebase ID token and active internal membership. No client-selected user ID. All amounts are integer GBP pence. Errors return `{error: string}`; provider failure never saves a guessed decision.

| Route                          | Request / response                                                              |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `GET /api/workspace`           | `{company, receipts}`; at most 500 expenses, newest first.                      |
| `POST /api/company`            | Full `Company`; saves `companies/primary`.                                      |
| `POST /api/extract`            | `{image: dataURL}` → nullable visible invoice fields.                           |
| `POST /api/receipts`           | `ReceiptInput` → classified `Receipt` in review state.                          |
| `POST /api/receipts/post`      | `{id}` → posted receipt and one atomic journal.                                 |
| `GET /api/conversations`       | Current member’s newest 100 conversation summaries, without messages.           |
| `GET /api/conversations/:id`   | An owned `Conversation`, including saved messages and tool cards.               |
| `POST /api/chat`               | `{conversationId: UUID, requestId: UUID, message}` → `{message, conversation}`. |
| `POST /api/voice`              | `{sdp, language?: "English" \| "Spanish", messages?: [{role, content}], toolCards?: boolean}` → authenticated NDJSON stream. |
| `GET /api/connections`         | Current user's active OAuth connections.                                        |
| `POST /api/connections/revoke` | `{id}` revokes a connection owned by the caller.                                |

The UI calls expenses “receipts”; API names remain stable while the Firestore collection is `/expenses`.

Voice events are `{type:"connected",sdp}`, `{type:"transcript",role,text,startMs,endMs}`,
`{type:"working"}`, `{type:"listening"}`, `{type:"tool",id,tool:ChatToolResult}`,
`{type:"error",message}` and `{type:"ended"}`. Tool snapshots come from successful
shared tool executions and use the same public schema as normal chat cards; their
per-call IDs prevent duplicate cards. Clients opt into tool events with `toolCards:true`,
keeping existing callers compatible. Each delegation exposes at most 12 cards. Speech and cards remain in arrival order in
the call chat and carry over to the current chat on hang-up.
`src/lib/voice.ts` validates the shared stream shape. A stream that closes without
`ended` is a failure. Offers are bounded to 100 KB and history to 16 messages of
5,000 characters. GPT-Live (`gpt-live-1`, Marin) handles speech; gpt-6-luna handles
delegated accounting requests through the same shared agent as text. No separate
voice business tools or posting permissions exist. Session creation and each agent
delegation consume the existing server AI quota. Transcripts are ephemeral and
provider storage is disabled (`store: false`). There is no telephone/PSTN dialing.

`sharedTools(uid)` provides `list_receipts`, `get_company`, `create_receipt`, `save_company`. The first two require MCP `accounts:read`; mutations require `receipts:write`. Agent-created receipts remain drafts. There is no post/submit/payment tool.

The event harness permits explicitly requested fake/random/sample receipts. Saul invents clearly fictional inputs, labels notes `SYNTHETIC TEST DATA`, sets `validInvoice=false`, and creates actual review drafts through the same shared tool (three by default, at most five per reply). This permission applies to text and delegated voice; real purchase evidence and completed actions are never fabricated. Decisions response IDs are optional: absent IDs are omitted from the stored VAT decision, never written as `undefined`. Malformed answers fail before expense creation.

`npm run test:tools` runs isolated backend tool and chat tests without a browser or frontend setup. The Firestore adapter rejects undefined values and applies transaction writes atomically; the chat integration suite uses the real Agents SDK with an isolated model provider.

`BCP_LIVE_TOOLS=1 npm run test:tools:live` additionally checks actual model/Decisions calls using a server `OPENAI_API_KEY` from the environment. It creates and lists synthetic drafts only in the isolated Firestore adapter, never in production. This opt-in check incurs provider usage and is excluded from the quick suite.

OAuth metadata lives at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. `/oauth/register` registers exact HTTPS (or loopback HTTP) callbacks; `/oauth/authorize` opens `/connect`; authenticated preview/approval endpoints show and approve consent; `/oauth/token` exchanges single-use S256 PKCE codes or rotates refresh tokens. `/oauth/revoke` revokes a connection. Tokens and codes are hashed at rest; access tokens expire after one hour, codes after two minutes. Resource binding is mandatory.

Expense lifecycle: `review → posted`. VAT decision: `deductible | not_deductible | review`. Payment is not represented yet. Future declaration lifecycle is `draft → validated → approved → sent → accepted`; it must remain separate from payment and generation/submission.

## Conversations

Conversations live in the root `/conversations` collection and are private to their
`createdBy` internal member. All reads and sends use the authenticated HTTP API;
the default-deny Firestore rule also covers this collection. Client-supplied
history, topics and provider fields are rejected. The server loads context from
the last 16 saved messages and runs at most six agent turns. A conversation holds
at most 60 messages and asks for a new conversation earlier if saved data exceeds
600 KB, leaving room for the next reply below Firestore’s document limit. Lists return the latest 100
conversations, sorted by update time, without a compound Firestore index.

Before each agent reply, Decisions (`gpt-6-luna`) selects exactly one topic:
`VAT | Bookkeeping | Annual accounts | Corporate Tax | Receipts`. The latest user
intent can change the topic. A topic is a routing label, never evidence that a
filing, payment or accounting action was completed. Provider errors or unusable
answers fail visibly; live requests never fall back to demo rules.

Each conversation has a transactionally claimed, five-minute send lease. A retry
of the latest completed `requestId` returns its saved reply without another
provider call. Overlapping sends fail explicitly. Failed runs release their lease
and retain completed history. Agent mutations retain their existing domain
permissions and idempotency rules; only explicit requests create drafts or save
company details, and no chat tool can post to the ledger.

Assistant messages may include `tools: ChatToolResult[]`. These are deterministic
snapshots from successful `sharedTools` executions, not model-generated card
payloads. Receipt cards contain integer-pence totals and draft/post state;
company cards omit tax identifiers. Company reads (`get_company`) are background
context: their snapshots are collapsed until the user activates the “Company
checked” pill, including in previously saved conversations. Company saves
(`save_company`) display their confirmation card immediately. The agent only
reads workspace data when needed for the current request; greetings and general
questions do not need tools. Snapshots include at most 20 receipts and
explicit total counts, at most 12 tool results per reply, and are retained for
the latest 10 messages. Older message text and tool pills remain. Tool pills and bounded card results appear while the server executes each tool. Final messages retain their activity history.

Demo conversations use browser-only storage under `bcp-demo-chats-v1`, labelled
`demo-rules`; live histories are never stored there. The floating chat and Chat
screen share one mounted session, including unsent text and in-flight requests.
Fresh assistant words fade in at 24 ms intervals (capped to a 1.4-second reveal)
with a 180 ms fade; history stays still, and reduced motion shows text immediately.
The card/pill presentation follows Goals Tracker and AVEC’s chat patterns.

## Live chat events

Each accepted `POST /api/chat` creates an owner-only root `/chatRuns/{requestId}` document in the same transaction that claims the conversation lease. The client subscribes before sending through an owner- and request-filtered Firestore `onSnapshot` query; an initially absent run is valid. Only active internal owners can read these documents. All client writes are denied. The HTTP API remains responsible for identity, membership, provider calls and mutations.

Run snapshots include classification, tool start/completion/failure, public assistant text and terminal state. Only normalized public SDK text deltas are published, never raw provider events or private reasoning. Text writes are serialized and coalesced to 250 ms with a trailing flush, following Goals Tracker's bounded progress-writer pattern. Completion cancels pending writes so old progress cannot overwrite the final state. Each attempt is fenced by a server-generated attempt ID. Limits are 10,000 reply characters, 80 activity events and 12 tool results.

The listener detaches before applying the final HTTP reply, on failure and on unmount/account changes. Navigating between the floating chat and the full chat keeps the same mounted owner and active subscription. Listener errors are visible while the real HTTP request continues; there is no demo fallback. Completed activity is saved with the assistant message and collapses in the UI, following AVEC's activity presentation.
