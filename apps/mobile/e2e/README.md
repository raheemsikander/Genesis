# Mobile E2E (Maestro)

End-to-end tests for `apps/mobile`, run with [Maestro](https://docs.maestro.dev)
against an iOS Simulator. See the "Mobile E2E" section of
`docs/setup/integrations/RUNNING_TESTS.md` for install and run instructions.

## Layout

- `config.yaml` — Maestro workspace config (discovers `flows/**`).
- `flows/<area>/*.yaml` — flows grouped by area (e.g. `smoke/`, `auth/`).
- `utils/env.e2e.ts` — validates the Clerk E2E test-user credentials.
- `run.ts` — validates env, injects the test-user credentials as Maestro `-e` vars, then invokes `maestro test`.

## testID naming convention

Flow tickets that need stable selectors add a `testID` prop to the element and
reference it from Maestro as `{ id: "<value>" }`.

**Scheme:** `<screen>-<element>-<role>`, kebab-case.

| Element | testID |
|---|---|
| Email field on the sign-in screen | `sign-in-email-input` |
| Password field on the sign-in screen | `sign-in-password-input` |
| Submit button on the sign-in screen | `sign-in-submit-button` |
| Welcome heading on the home tab | `home-welcome-heading` |

Maestro usage:
```yaml
- tapOn:
    id: "sign-in-submit-button"
- assertVisible:
    id: "home-welcome-heading"
```

Prefer `testID` over visible-text matching for anything a flow taps or asserts —
text matching breaks on copy/layout changes.
