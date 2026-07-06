# Local Mocks in Postman — Dos and Don'ts

A quick reference for working with **local (script-based) mock servers** in Git-backed
Postman projects, and for keeping them healthy in CI/CD workspace sync.

A local mock is defined by two files that live in your repo (typically under
`postman/mocks/`):

- **`mock.json`** — the mock *configuration* (name, port, protocol, routes, logging).
- **`mock.js`** — the mock *implementation* (a Node HTTP handler that matches
  requests and serves responses, often from your saved examples via `pm.mock`).

---

## Dos

- **Do set `version` to the integer `1`.** The mock config schema expects a number.
  ```json
  { "version": 1 }
  ```
- **Do declare a `routes` array** listing every method + path your mock serves. This
  is what lets the workspace sync push the mock declaratively.
  ```json
  "routes": [
    { "method": "GET",  "path": "/airports" },
    { "method": "POST", "path": "/api/v1/payments" },
    { "method": "GET",  "path": "/api/v1/payments/{paymentId}" }
  ]
  ```
- **Do commit both `mock.json` and `mock.js`** to Git. The config alone can't run;
  the implementation alone can't be described to the workspace.
- **Do run the mock locally with the config file**, not the script:
  ```bash
  postman mock run "./postman/mocks/mock.json"
  ```
- **Do keep the config and implementation in sync.** Every route in `mock.json`
  should have a matching handler branch in `mock.js`, and vice versa.
- **Do use collection examples as the source of truth** for response bodies where
  possible (`pm.mock.sendExample` / example files), so the mock and the API contract
  stay aligned.
- **Do use a distinct `port` per mock** to avoid collisions when running several
  local mocks side by side.
- **Do exercise the mock in CI** as a local server (start it, wait for readiness,
  run a collection against it, tear it down) — this catches drift early.

---

## Don'ts

- **Don't use a string for `version`** (e.g. `"1.0"`). A string fails schema
  validation, and the workspace sync silently falls back to a script-based push path
  that isn't available in headless CI. The confusing symptom is:
  > `Mock push is not configured: pass mockService to CompositePushStrategy to enable script-based mock pushes`

  The real fix is almost always `"version": "1.0"` → `"version": 1`.
- **Don't drop the `routes` array** thinking the script is enough. Without routes,
  the sync has nothing declarative to push and falls back to the unavailable
  script-push path.
- **Don't invent config keys.** Use the documented logging keys
  (`showRequestBody`, `showResponseBody`) rather than guessing (`showBody`).
- **Don't assume the error message names the root cause.** The `mockService` /
  `CompositePushStrategy` error is a *fallback* symptom — start by validating
  `mock.json` against a known-good config.
- **Don't point `postman mock run` at the `.js` file** as your standard entry point;
  drive the mock through its `.json` config so ports, routes, and logging apply.
- **Don't let the config and script diverge.** A route in `mock.json` with no
  handler in `mock.js` (or the reverse) leads to unmatched requests and confusing
  404s.
- **Don't hardcode secrets** into `mock.js`. Use environment variables / Postman
  environments for anything sensitive.

---

## Troubleshooting: workspace sync fails on the mock

When `workspace push` (or a CI sync job) reports the mock **failed to create/update**
while collections, environments, and specs succeed:

1. **Check `version` first** — it must be the integer `1`, not `"1.0"`.
2. **Confirm the `routes` array exists** and lists every endpoint.
3. **Compare against a known-good `mock.json`** from a repo whose sync works; diff the
   two configs — the difference is usually a single mistyped field.
4. **Validate the JSON** (no trailing commas, correct types).

> Tip: a script-based mock *can* be synced to the workspace — as long as its
> `mock.json` config is schema-valid. "Script-based" is not the blocker; an invalid
> config is.
