# Handoff — PostAir spec governance cleanup

Context handoff for a Claude Code session running **inside this repo**
(`postair-weather-api`). The prior work happened from the
`skilljar-widget-component-library` repo, which backs the Postman Academy
"Establishing a Baseline API Governance" course + Arcade demo. This spec is the
demo subject. Pick up from **"Where things stand"** below.

_Written 2026-07-09._

---

## Goal

Get the OpenAPI spec to a **clean `postman spec lint`** run so it can be the
green "after" state in a governance Arcade demo (and a CI gate). The demo story:
edit spec → lint locally in Native Git terminal → read violations → fix → re-lint
clean → add the same command to CI (GitHub Actions).

The verified lint command (confirmed against `postman spec lint --help`, Postman
CLI v12):

```bash
postman spec lint <path-to-spec> --fail-severity warning
# flag is --fail-severity (NOT --fail-on-severity); values lowercase: error|warning|info|hint
```

---

## Files in play

| Path | What it is |
|------|-----------|
| `specs/v1/postair-openapi-3_1.yaml` | Original spec. Had 58 lint problems. Was previously at `api-docs/`, then moved to `specs/v1/`. |
| `specs/v2/postair-openapi-3_1.yaml` | **Corrected spec — the working file.** Down to 32 errors (all the same root cause; see below). Note: `info.version` was bumped to `2.0.0` in this file (by the user); the API itself is still functionally v1 — decide whether that bump is intended. |
| `.postman/resources.yaml` | Native Git resource mapping. **Currently broken** (see "Known issues"). |

---

## What's been fixed in `specs/v2/postair-openapi-3_1.yaml`

Started at **58 problems (52 errors, 6 warnings)**. Fixes applied:

1. **Quoted every HTTP status-code key** (`"200":`, `"404":`, …). Unquoted numeric
   keys parsed as numbers; OpenAPI requires Responses Object keys to be strings.
   This was the root of the 52 syntax errors and was **masking governance
   analysis** (a live demonstration of Lesson 3's "fix Syntax before Governance"
   point — until syntax was clean, the governance rules below weren't even
   reported).
2. **`info.contact`** added (rule: `info-contact`).
3. **`servers`** entry added (rule: `oas3-api-servers`).
4. **`operationId`** on each operation, lower-hyphen-case: `get-airports`,
   `get-turbulence`, `get-forecast`, `get-metars` (rule: `operation-operationId`
   — note this rule enforces presence **and** lower-hyphen-case naming).
5. **`components.schemas.airportCodes`** given a sibling `items` (was `type: array`
   with `properties`, which is invalid).
6. **5 inline header/parameter schemas extracted** to `components.schemas` and
   referenced via `$ref` (rule: schema-property-should-$ref). New leaf schemas:
   `ContentTypeString`, `CorrelationIdString`, `CountryName`, `AirportCodeQuery`,
   `ForecastCity`.
7. Tidied two copy-paste example keys (403/500 response example names).

Validated with `pyyaml`: parses clean, all response keys are strings, all
header/param schemas are `$ref`s.

---

## Where things stand — the LAST blocker (needs a decision)

Re-lint of `specs/v2/` now returns **32 errors, 0 warnings** — and they are all
the *same* finding, repeated:

```
paths.<path>.get.responses.<4xx|5xx>.content   ERROR  must match format "media-range"   Syntax
paths.<path>.get.responses.<4xx|5xx>.content   ERROR  property name must be valid       Syntax
```

### Root cause (confirmed)

The errors land **only** on the `application/problem+json` content blocks. The
`application/json` blocks (the `200` responses) pass. The arithmetic is exact:
**16 `application/problem+json` keys × 2 errors = 32**.

`application/problem+json` is a valid RFC 7807 media type, but Postman's
`spec lint` media-range validator rejects the `+json` structured-syntax suffix
(it accepts `application/json` but not `application/problem+json`). The file has
no hidden characters — verified via `od -c` on the flagged lines. This is a
linter limitation, not a spec bug.

### The decision to make

**Option A (recommended for the demo): switch the 16 error-response media types
from `application/problem+json` → `application/json`.** Clears all 32 errors →
fully clean lint. Minor semantic loss: error bodies are no longer *labeled*
`problem+json`, but the `problemDetail` schema still conforms to RFC 7807
structurally. This is the pragmatic path to the green "after" state the demo
needs.

**Option B: keep `application/problem+json`.** Technically more correct
(RFC 7807), but the demo never reaches a clean lint. Only choose this if
preserving the problem+json label outweighs a passing lint.

The user was asked this and redirected to create this handoff instead — so
**the media-type decision is still open.** Confirm with the user, then apply.

If Option A: replace all 16 occurrences of `application/problem+json:` with
`application/json:` in `specs/v2/postair-openapi-3_1.yaml` (the content-block
keys only — leave the `problemDetail` schema and the `ContentTypeString` default
alone unless you also want those cosmetically aligned), then re-run
`postman spec lint specs/v2/postair-openapi-3_1.yaml --fail-severity warning` to
confirm 0 problems.

---

## Known issues / loose ends in this repo

1. **Broken Native Git link.** `.postman/resources.yaml` points
   `localResources.specs` at `../postman/specs/postair-weather-api/…` (a path
   that doesn't exist) and `cloudResources.specs` is now `{}`. Moving the spec
   out of `api-docs/` de-linked it from the Postman workspace. The lint report
   header shows Postman reading it from
   `postman/specs/postair-weather-api/v2/postair-openapi-3_1.yaml`, so the app
   may have re-scaffolded a copy there — **reconcile the actual on-disk location
   vs. what `.postman/resources.yaml` and the workspace point at**, and re-link
   the spec from its canonical path in the Postman app (unlink old, add new) so
   the cloud mapping is restored.
2. **v1 vs v2 coexist.** `specs/v1/` (original, broken) and `specs/v2/` (fixed)
   both exist. Decide whether v2 replaces v1 or sits beside it, then clean up.
   Also settle naming: the `-3_1` suffix encodes the OAS format version, which is
   redundant with `openapi: 3.1.0` inside the file — consider
   `specs/v1/postair-openapi.yaml` (API version in the folder, not the format in
   the filename).
3. **`info.version: 2.0.0`** in `specs/v2/` — confirm this bump is intended vs. a
   side effect of the "v2 folder" naming.

---

## Downstream consumers (in the OTHER repo, `skilljar-widget-component-library`)

Once the spec is clean, these reference it and may need path/content updates:

- `docs/arcade-script-spec-lint-governance.md` — the Arcade recording script.
  Uses the demo path `./specs/…`; update to the final spec path.
- `docs/postair-openapi-3_1.corrected.yaml` — an earlier mirrored "corrected"
  copy (only had the contact/servers/operationId fixes, **not** the syntax +
  $ref fixes). Should be re-synced from the final `specs/v2` once the media-type
  decision is applied, or deleted in favor of pointing at this repo.
- The course lesson itself (`examples/establishing-baseline-api-governance/
  lesson-4-adding-postman-spec-lint-to-ci.html`) has an Arcade **placeholder**
  awaiting the recorded demo.

These live in the sibling repo — coordinate, don't edit them from here.

---

## Suggested next steps (in order)

1. Get the user's decision on the media-type question (Option A vs B above).
2. Apply it to `specs/v2/postair-openapi-3_1.yaml`.
3. Re-run `postman spec lint specs/v2/postair-openapi-3_1.yaml --fail-severity warning`
   → confirm **0 problems**.
4. Reconcile the Native Git link + v1/v2 + filename questions.
5. Tell the user to re-sync the sibling repo's `docs/` copy + Arcade script paths.
