# Security Policy

## Trust boundary

Surge response scripts execute against traffic decrypted on the device. A script that can make outbound requests, control Surge, persist arbitrary data, or log response bodies is outside this repository's default trust boundary.

Candidate modules are not stable releases. Static checks do not prove that a current iOS App response schema is compatible.

## Forbidden by default

- `$httpClient`, `$task.fetch`, `$httpAPI`
- `$persistentStore`, `$prefs`
- `eval`, `Function`, dynamically loaded code
- complete request/response body, headers, Cookie or Authorization logging
- `skip-server-cert-verify`
- wildcard MITM hostnames
- `max-size=0`
- payment, order, chat, authentication, route/location or device-control endpoints

## Reporting

Do not attach real traffic captures to a public issue. Remove or replace Cookie, Token, device identifiers, account identifiers, location, order and message data before sharing a minimal fixture.

## Promotion

A candidate can move to stable only after:

1. static audit passes;
2. redacted or synthetic fixture tests pass;
3. no-ad responses pass through unchanged;
4. errors fail open;
5. one iPhone canary runs for 24–48 hours without functional regression.
