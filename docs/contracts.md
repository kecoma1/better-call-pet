# HTTP and tool contracts

All `/api/*` routes except `/api/health` and the explicitly public invoice PDF endpoint require a verified Firebase ID token. Workspace routes accept either active internal membership (shared internal books) or an anonymous provider identity (isolated persistent demo). OAuth consent and connection routes remain internal-only. No client-selected user ID. All amounts are integer GBP pence. Errors return `{error: string}`; provider failure never saves a guessed decision.

| Route                          | Request / response                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `GET /api/workspace`           | `{company, receipts}`; at most 500 expenses, newest first.                          |
| `POST /api/company`            | Full `Company`; saves `companies/primary`.                                          |
| `POST /api/extract`            | `{image: dataURL}` → nullable visible invoice fields.                               |
| `POST /api/receipts`           | `ReceiptInput` → classified `Receipt` in review state.                              |
| `POST /api/receipts/post`      | `{id}` → posted receipt and one atomic journal.                                     |
| `GET /api/conversation` | Current identity’s saved chat messages; up to 100 messages of 5,000 characters. |
| `POST /api/conversation` | `{messages: [{role, content}]}` saves that identity’s conversation. |
| `POST /api/chat`               | `{messages: [{role, content}]}` → `{message}`. Up to 16 messages and 6 agent turns. |
| `POST /api/voice`              | `{sdp, language?: "English" \| "Spanish", messages?: [{role, content}]}` → authenticated NDJSON stream. |
| `GET /api/connections`         | Current user's active OAuth connections.                                            |
| `POST /api/connections/revoke` | `{id}` revokes a connection owned by the caller.                                    |

The UI calls expenses “receipts”; API names remain stable while the Firestore collection is `/expenses`.

Voice events are `{type:"connected",sdp}`, `{type:"transcript",role,text,startMs,endMs}`,
`{type:"working"}`, `{type:"listening"}`, `{type:"error",message}` and `{type:"ended"}`.
`src/lib/voice.ts` validates the shared stream shape. A stream that closes without
`ended` is a failure. Offers are bounded to 100 KB and history to 16 messages of
5,000 characters. GPT-Live (`gpt-live-1`, Marin) handles speech; gpt-6-luna handles
delegated accounting requests through the same shared agent as text. No separate
voice business tools or posting permissions exist. Session creation and each agent
delegation consume the existing server AI quota. The latest 100 chat messages include saved voice captions; audio is not stored and
provider storage is disabled (`store: false`). There is no telephone/PSTN dialing.

`sharedTools(uid)` provides `list_receipts`, `get_company`, `create_receipt`, `save_company`. The first two require MCP `accounts:read`; mutations require `receipts:write`. Agent-created receipts remain drafts. There is no post/submit/payment tool.

OAuth metadata lives at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. `/oauth/register` registers exact HTTPS (or loopback HTTP) callbacks; `/oauth/authorize` opens `/connect`; authenticated preview/approval endpoints show and approve consent; `/oauth/token` exchanges single-use S256 PKCE codes or rotates refresh tokens. `/oauth/revoke` revokes a connection. Tokens and codes are hashed at rest; access tokens expire after one hour, codes after two minutes. Resource binding is mandatory.

Expense lifecycle: `review → posted`. VAT decision: `deductible | not_deductible | review`. Payment is not represented yet. Future declaration lifecycle is `draft → validated → approved → sent → accepted`; it must remain separate from payment and generation/submission.


## Sales invoice drafts

`GET /api/invoices` returns the latest 500 shared invoice drafts. `POST /api/invoices` accepts
`InvoiceInput` from `src/domain.ts`: a unique invoice `number`, ISO `issueDate` / `dueDate`,
`sellerAddress`, `customerName`, `customerAddress`, 1–50 `lines`, `notes` and `paymentDetails`.
Each line has `description`, positive integer `quantity`, integer `unitPence`, and explicit
whole-line integer `vatPence`. Currency is GBP. The server snapshots public seller details
from `companies/primary`; it never exports the company UTR. VAT requires company registration
and a saved VAT number. Dates, totals and PDF-compatible Latin text are validated server-side.

Creation is atomic and idempotent by the normalized invoice number. Identical retries return
the existing immutable draft and its original seller snapshot. Changed details with the same
number are rejected. Invoices remain `draft`; creating or downloading one never writes an
expense, sales journal, payment, or tax submission. Issuing, editing, sending and payment
tracking are outside this version.

`POST /api/invoices/download` with `{id}` requires workspace access and returns
`{url, publicUrl, filename}`. `publicUrl` opens a PDF inline at
`GET /api/invoices/public/:token`; `url` adds `?download=1` for an attachment download.
Creation explicitly publishes this draft behind a random 256-bit URL. Anyone with that URL
can view/download it without signing in. URLs are stable, have no expiry, and carry no user
credentials. Responses use `no-store`, `no-referrer` and `noindex`; these are not access controls.
There is no public invoice directory or revoke-link action in this version. Root `invoiceLinks`
stores hashed tokens pointing to `/invoices`; both collections deny all direct browser access.
The PDF is generated from the immutable invoice on request; no separate PDF object is stored.

Agent and MCP both use `sharedTools`: `list_invoices`, `get_invoice_download` and
`download_invoice` require `accounts:read`; `create_invoice` requires the new explicit
`invoices:write` OAuth scope. Existing receipt-write grants do not authorize invoice creation;
clients must request consent for the new scope. `create_invoice` returns `{invoice, download}`,
including both public URLs. `download_invoice` returns the PDF as an embedded MCP resource
(`application/pdf`, base64 blob) alongside its filename and links. The agent receives compact
file metadata and returns clickable download/view links; binary content stays out of its context.

Anonymous demo drafts are stored in isolated server demo collections and support public PDF
links with DEMO markings (`demo: true` on the invoice). The unconfigured offline demo alone
uses browser storage and local blob PDF links. The caller cannot select another workspace
through request fields. Invoice IDs and numbers can repeat across isolated demos safely.
