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
| `GET /api/connections`         | Current user's active OAuth connections.                                        |
| `POST /api/connections/revoke` | `{id}` revokes a connection owned by the caller.                                |

The UI calls expenses “receipts”; API names remain stable while the Firestore collection is `/expenses`.

`sharedTools(uid)` provides `list_receipts`, `get_company`, `create_receipt`, `save_company`. The first two require MCP `accounts:read`; mutations require `receipts:write`. Agent-created receipts remain drafts. There is no post/submit/payment tool.

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
the latest 10 messages. Older message text and tool pills remain. Tool pills appear with the
finished answer; this endpoint does not stream tool execution.

Demo conversations use browser-only storage under `bcp-demo-chats-v1`, labelled
`demo-rules`; live histories are never stored there. The floating chat and Chat
screen share one mounted session, including unsent text and in-flight requests.
Fresh assistant words fade in at 24 ms intervals (capped to a 1.4-second reveal)
with a 180 ms fade; history stays still, and reduced motion shows text immediately.
The card/pill presentation follows Goals Tracker and AVEC’s chat patterns.
