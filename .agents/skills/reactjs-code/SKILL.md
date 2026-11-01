---
name: reactjs-code
description: Apply the React single-page application architecture, component and hook conventions, the services layer that owns every network call, shadcn/ui primitive rules, and the mandatory unit and end-to-end testing rules. Use whenever creating, changing, or reviewing pages, routes, React components, hooks, utilities, or complete features in a client-rendered React app.
metadata:
  short-description: React SPA architecture and shadcn rules
---

# React Code

Build against the architecture documented in `README.md` and `docs/`. These rules target a
client-rendered React application — Vite or an equivalent bundler — using shadcn/ui primitives and
talking to an HTTP API it does not run.

Inspect the implemented package structure and test tooling before coding, and follow the established
local conventions. For a Next.js App Router codebase use the `nextjs-code` skill instead: the server
boundary changes almost every rule below.

## Structure

```text
src/
  main.jsx              mounts the app; no application logic
  App.jsx               routes and the shell that survives navigation
  pages/<name>.jsx      one file per route, composing components
  components/<name>.jsx one component per file, PascalCase export
  components/ui/        shadcn primitives, exactly as generated
  hooks/use-<name>.js   reusable stateful behaviour
  services/<domain>.js  every network call, one module per API domain
  lib/                  pure helpers with no React and no fetch
```

- **Give every component its own file.** Do not declare a second reusable or substantial component
  inside another component's file. A tiny presentational fragment used once in the same file is the
  only exception.
- Name components in PascalCase, files in kebab-case, hooks with the `use` prefix.
- Group route-specific components by domain, one folder per domain area once a domain outgrows two
  files.
- Reuse existing components. Extend a shared component through props instead of cloning it.

## The Services Layer

**Components and hooks never call `fetch` directly.** Every request lives in `services/<domain>.js`,
one module per API domain, exporting named functions in the vocabulary of the domain
(`fetchPeople`, `renamePerson`) rather than of the transport (`get`, `post`).

A service function owns the whole round trip: the URL, the request shape, the failure check, and
the parsing of the response into the shape the app uses.

```js
export async function fetchPeople({ signal } = {}) {
    const response = await fetch(`${PEOPLE_URL}?named=false`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
    });

    if (!response.ok) {
        throw new Error(`The server returned HTTP ${response.status}.`);
    }

    return normalizePeople(await response.json());
}
```

- **Validate the response shape before returning it.** A service that hands back
  `await response.json()` unchecked pushes the API's failure modes into rendering, where they
  surface as a blank screen. Check the shape, throw a readable error if it is wrong.
- Accept an `AbortSignal` on every read so callers can cancel on unmount.
- Keep retry and polling cadence in the hook, not in the service. A service performs one request.
- The service layer is also where an API's naming is translated into the app's: if the backend
  returns `snake_case`, normalize it once here rather than spreading it through components.

## Hooks

- Keep hooks small and focused on one reusable behaviour.
- **Every effect that starts something must stop it.** Return a cleanup that aborts in-flight
  requests, clears timers, and disconnects observers. A polling hook that does not cancel on unmount
  keeps running for the life of the tab.
- Guard against setting state after unmount: abort the request rather than checking a flag after the
  fact.
- A hook that polls should also expire its own data on a separate timer. If the requests start
  failing, stale data must age out instead of freezing on screen.

## shadcn/ui Primitives

- **Use shadcn/ui components exclusively for UI primitives. No exceptions.** Buttons, inputs, labels,
  selects, dialogs, alerts, cards, tables, and every other primitive come from `components/ui/`.
  Never hand-roll a styled `<button>`, `<input>`, `<label>`, or a bordered `<div>` standing in for a
  card or a table.
- Add a missing primitive with `npx shadcn@latest add <component>` and keep it as generated. Do not
  fork a primitive into a bespoke variant.
- Keep primitives at their stock API: the documented `variant` and `size` values, plus `className`
  for layout. Do not add project-specific props (`fullWidth`, `loading`, `iconLeft`).
- Express loading and icon states by composing children inside the primitive, not by extending it:
  `<Button disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null}Save</Button>`.
- The design is **monotone**: use only the theme variables (`background`, `foreground`, `muted`,
  `primary`, `secondary`, `destructive`, `border`, `input`, `ring`, `accent`, `card`, `popover`).
  Never introduce a new colour token or a raw hex value in a component.
  - The one exception is a mark drawn over content the theme does not control — a bounding box over
    video, a series in a chart. Those need a colour that survives whatever is underneath. Keep such
    values in one named constant, not scattered through JSX.
- Domain components compose primitives; they never restyle them.

## Forms

- Controlled inputs, with the value owned by the component that submits.
- **Disable the submit control while the request is in flight** and while the form is invalid. A
  double-submitted form is the default behaviour of a button unless you prevent it.
- Show the failure where the user is looking — beside the form, not in a console — and keep the
  entered values so the submission can be retried.
- Pair every input with a `Label` whose `htmlFor` matches the input `id`. A placeholder is not a
  label.
- Close a dialog only after the request succeeds, never optimistically on click.

## Data and Domain Rules

- Fetch shared data once at the highest appropriate boundary and pass results down.
- Name one source of truth per kind of data, and treat anything derived from it as rebuildable.
- Preserve the documented lifecycle of every stateful entity instead of inventing intermediate
  states.
- Keep all user-facing copy in the project's primary locale unless the translation system supplies
  it.

## Security

- **The browser holds no secrets.** Everything bundled ships to the user: an API key in a `VITE_*`
  variable is published, not configured. Only non-sensitive configuration belongs there.
- **The API is the authorization boundary; client-side guards are UX only.** A route that hides a
  control does not protect the operation behind it. Every sensitive read and write must be rejected
  by the server.
- A record the user may not see must be absent from the response, not merely hidden by the client.
- Never trust anything the client can set — role, ownership, price, identity — on the way back to the
  server.

## Mandatory Tests

Testing is part of implementation, not follow-up work.

- **Every new component must have unit tests. No exceptions.** This includes pages, forms,
  providers, and small wrappers. Cover meaningful rendering, behaviour, accessibility, and the empty
  and failure states.
- **Every new utility and service must have unit tests. No exceptions.** Cover normal input,
  boundaries, invalid input, and the failure path — a service's error branch is the one that fires
  in production.
- Query by accessible role and name (`getByRole("button", { name: /save/i })`) rather than by test
  id or class, so the test breaks when the accessibility does.
- Assert on what the user sees, not on internal state or how many times a function ran.
- **Every new feature must include feature-specific end-to-end tests.** Agree the scenarios with the
  developer before writing them.
- Use the repository's configured runners. If they do not exist, establish them as part of the
  feature setup and agree the approach with the developer first.
- Do not mark work complete, open a PR, or report success while required tests are missing or
  failing.

## Verification

Run the applicable repository scripts and report the exact commands and their outcome:

- lint
- unit tests
- feature-specific E2E tests
- production build
