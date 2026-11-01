---
name: cloud-functions
description: Apply Firebase Cloud Functions backend rules for authentication, permissions, object-storage presigned URLs, Firestore metadata, vector indexing and search, AI provider calls, audit logging, and backend tests. Use whenever creating or changing callable, HTTP, scheduled, or event-driven functions and their client wrappers.
---

# Cloud Functions

Cloud Functions are the project's trusted business-logic boundary. Read the architecture and the security/permissions documents in `docs/`, plus the relevant ADR, before changing a backend flow.

The reference flows below assume a stack of Firebase (Auth, Firestore, Functions) with S3-compatible object storage, a vector database, and an AI provider. Map them onto the equivalent services when the project uses a different provider.

## Backend Boundary

- Keep Firebase Admin, R2, Qdrant, and OpenAI credentials and SDK calls server-only.
- Verify Firebase authentication on every user-triggered function.
- Check the user's current blocked state and effective permission before reading metadata, issuing a presigned URL, mutating a file, or searching Qdrant.
- Derive roles and accessible folders on the server. Never accept a client-supplied authorization decision.
- Deny by default. Explicit `deny` permissions override direct grants and inherited folder grants.
- Audit administrative actions and file access as required by the project's security and permissions documentation.

## Function Structure

- Keep handlers thin: authenticate, validate, authorize, call a domain service, log, and return a typed result.
- A function's own file holds the cloud function and nothing else: its imports, the trigger definition with its handler, and the export. It must never declare a utility — no helper function, no constant, no type, interface or schema — not even a one-line error reader used exactly once by that handler.
- Every helper a handler needs lives in a shared server module the handler imports, named for the concern it covers and placed beside the project's other utilities. Reuse the existing module for that concern before adding a new one.
- Before finishing a backend change, check that each touched function file has exactly one top-level declaration, the trigger, followed by its export. Move anything else out.
- Put reusable Firestore, R2, Qdrant, OpenAI, permission, validation, and audit logic in focused server modules.
- Keep function names and exports stable once deployed. Centralize the Firebase region and runtime options instead of repeating literals.
- Validate every external payload at the boundary and return stable error codes without leaking secrets, inaccessible resource details, or provider responses.
- Make state transitions and provider writes idempotent so interrupted uploads and retries are safe.

## Reference Flows

### Upload and indexing

1. Authenticate and verify write permission on the target folder.
2. Create Firestore metadata and a version record in `pending` state.
3. Issue a short-lived presigned R2 upload URL for the exact immutable object key.
4. On confirmation, verify the expected object and transition to `ready`.
5. Queue the indexing request and let the background trigger generate the embedding from the user description and upsert Qdrant. The point ID is the file's `qdrantPointId` UUID (Qdrant rejects a Firestore auto-ID) and `payload.fileId` links the point back to Firestore.
6. Transition to `indexed`, recording model and indexing timestamps.

Never allow the browser to choose an unrestricted R2 key or write directly to Qdrant.

### Search

- Resolve effective permissions before querying.
- Apply allowed folders and explicit denials inside the Qdrant filter so inaccessible files never enter the candidate set.
- Combine semantic results with the documented metadata filters for name, date, extension, folder, and status.
- Treat Qdrant as derived data; provide a controlled reindex path from Firestore.

### Download and versions

- Authorize the requested file and version before issuing a short-lived presigned download URL.
- Keep R2 objects immutable. A new version receives a new key; restoring an old version creates an additional current version rather than overwriting history.

## Configuration

Use the documented environments: local emulators with `<project-name>-dev`, staging with `<project-name>-staging`, and production with `<project-name>-prod`. Keep all configuration centralized and validated at startup.

Server-only variables include:

- `FIREBASE_SERVICE_ACCOUNT`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- `QDRANT_URL`, `QDRANT_API_KEY`
- `OPENAI_API_KEY`

Never log secret values, presigned URLs, full document contents, embeddings, or raw AI inputs.

## Logging and Errors

- Use structured logs with the function or operation name and safe identifiers such as `uid`, `fileId`, `folderId`, and `versionId`.
- Log start, authorization outcome, state transitions, provider latency, retry decisions, and errors.
- Avoid personal data and file contents unless explicitly required and protected.
- Map provider failures to stable application errors and preserve the original error only in protected server logs.

## Tests and Verification

- Unit-test every new utility and domain service, including authorization and state-transition edge cases.
- Test handlers with Firebase emulators or isolated provider adapters; mock R2, Qdrant, and OpenAI at their boundaries.
- Add integration coverage for permission filtering, interrupted uploads, idempotent retries, and index consistency when relevant.
- Run the functions lint, typecheck, unit tests, and build scripts defined by the repository. Run affected app and E2E checks when a backend change alters a user feature.
