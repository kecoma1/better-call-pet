# HTTP and tool contracts

All `/api/*` routes except `/api/health` require a Firebase ID token and active internal membership. No client-selected user ID. All amounts are integer GBP pence. Errors return `{error: string}`; provider failure never saves a guessed decision.

| Route                          | Request / response                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `GET /api/workspace`           | `{company, receipts}`; at most 500 expenses, newest first.                          |
| `POST /api/company`            | Full `Company`; saves `companies/primary`.                                          |
| `POST /api/extract`            | `{image: dataURL}` → nullable visible invoice fields.                               |
| `POST /api/receipts`           | `ReceiptInput` → classified `Receipt` in review state.                              |
| `POST /api/receipts/post`      | `{id}` → posted receipt and one atomic journal.                                     |
| `POST /api/chat`               | `{messages: [{role, content}]}` → `{message}`. Up to 16 messages and 6 agent turns. |
| `GET /api/connections`         | Current user's active OAuth connections.                                            |
| `POST /api/connections/revoke` | `{id}` revokes a connection owned by the caller.                                    |

The UI calls expenses “receipts”; API names remain stable while the Firestore collection is `/expenses`.

`sharedTools(uid)` provides `list_receipts`, `get_company`, `create_receipt`, `save_company`. The first two require MCP `accounts:read`; mutations require `receipts:write`. Agent-created receipts remain drafts. There is no post/submit/payment tool.

OAuth metadata lives at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`. `/oauth/register` registers exact HTTPS (or loopback HTTP) callbacks; `/oauth/authorize` opens `/connect`; authenticated preview/approval endpoints show and approve consent; `/oauth/token` exchanges single-use S256 PKCE codes or rotates refresh tokens. `/oauth/revoke` revokes a connection. Tokens and codes are hashed at rest; access tokens expire after one hour, codes after two minutes. Resource binding is mandatory.

Expense lifecycle: `review → posted`. VAT decision: `deductible | not_deductible | review`. Payment is not represented yet. Future declaration lifecycle is `draft → validated → approved → sent → accepted`; it must remain separate from payment and generation/submission.
