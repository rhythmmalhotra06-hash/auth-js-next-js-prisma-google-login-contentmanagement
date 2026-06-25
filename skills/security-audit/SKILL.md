---
version: 1.0.0
author: Norman
description: Run a comprehensive security audit of the codebase against project security standards. Reports all issues with severity, location, and recommended fix.
allowed-tools: Read, Glob, Grep, Bash(git log *), Bash(git diff *), Bash(pnpm audit *), Bash(npx linear issue view *)
---

# /security-audit — Comprehensive Security Audit

Run a comprehensive security audit of the BlinkLife codebase against the project's security standards and the findings from BLI-24. Report all issues found with severity, location, and recommended fix.

## Audit Checks

Run all checks below in parallel where possible. For each check, report: **status** (PASS / FAIL / WARN), **location** (file:line), and **details**.

---

### 1. Secrets & Credentials

Scan for hardcoded secrets, API keys, tokens, passwords, and connection strings in source code (excluding `node_modules`, `.env` files, and lockfiles).

```bash
# Real API keys (Google, AWS, Stripe, etc.)
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" -E "(AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{24,}|sk-[0-9a-zA-Z]{48}|ghp_[0-9a-zA-Z]{36})" --exclude-dir=node_modules .

# Hardcoded passwords/secrets in source
grep -rn --include="*.ts" --include="*.tsx" -E "(password|secret|apiKey|api_key|token)\s*[:=]\s*['\"][^'\"]{8,}" --exclude-dir=node_modules .
```

Check `.env.local.example` files for real credentials (not placeholders).

### 2. Authentication & Authorization

- **JWT storage**: Check if tokens are stored in `localStorage` or `sessionStorage` (XSS risk — should use httpOnly cookies)
  - Search: `localStorage.setItem`, `localStorage.getItem` in auth-related files
- **Token revocation**: Check if a server-side logout/token blacklist endpoint exists
  - Search for `POST /auth/logout` or token blacklist logic
- **Server-side auth middleware**: Check for `middleware.ts` in `apps/web/` and `apps/admin/`
- **Auth guard coverage**: Check for unprotected endpoints that should require auth
- **devLogin fallback**: Ensure no development login bypass exists in production code paths
  - Search for `devLogin`, `dev_login`, `bypassAuth`, `skipAuth`

### 3. Input Validation

- **Unvalidated endpoints**: Find controller methods without `@UsePipes(ZodValidationPipe)` or manual validation
  - Compare controller methods against their Zod schema coverage
- **Raw SQL**: Search for `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe`
- **dangerouslySetInnerHTML**: Search for usage across all React apps
- **File upload validation**: Check that uploads enforce MIME type, extension, and size limits

### 4. Security Headers & CORS

- **CORS configuration**: Verify `main.ts` uses allowlisted origins (not `*`)
- **Helmet**: Verify `helmet()` middleware is applied
- **CSP headers**: Check `next.config.ts` in web and admin for Content-Security-Policy
- **Rate limiting**: Verify `ThrottlerGuard` is applied globally and on sensitive endpoints

### 5. Sensitive Data Exposure

- **Profile endpoints**: Check that user queries use explicit `select` (not returning full User objects with internal fields)
- **Error responses**: Verify `TransformInterceptor` strips stack traces and internal details
- **Logging**: Check that logging does not include PII (emails, tokens, passwords)
- **API responses**: Check for endpoints that may leak `authProviderId`, password hashes, or internal IDs

### 6. Cryptographic Issues

- **Timing-safe comparison**: Check `api-key.guard.ts` uses `crypto.timingSafeEqual` (not `===` or `!==`)
- **Password hashing**: If any local auth exists, verify bcrypt/argon2 with appropriate rounds
- **Token generation**: Verify tokens use `crypto.randomBytes` or equivalent CSPRNG

### 7. Build & Dependency Security

```bash
# Check for typescript.ignoreBuildErrors
grep -rn "ignoreBuildErrors" apps/web/next.config.ts apps/admin/next.config.ts 2>/dev/null

# Check npm audit
pnpm audit 2>&1 | tail -20
```

### 8. Code Quality Security Patterns

- **`any` type usage**: Count instances of `: any` that could mask type safety issues in security-critical code (auth, validation, guards)
- **Unchecked user input in queries**: Look for request params/body used directly in Prisma queries without validation
- **SSRF vectors**: Check for user-controlled URLs passed to `fetch()`, `axios()`, or similar

---

## Output Format

```
# Security Audit Report — [date]

## Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X     |
| HIGH     | X     |
| WARN     | X     |
| PASS     | X     |

## Critical Findings
[Each finding with: title, file:line, description, recommended fix]

## High Findings
[Same format]

## Warnings
[Same format]

## Passed Checks
[Brief list of what passed]

## Comparison with BLI-24
[Cross-reference findings against BLI-24 audit report — note what's been fixed, what's still open, and any NEW findings not in the original audit]

## Recommended Priority
[Ordered list of what to fix first based on severity and effort]
```

---

## Rules

- **Do not fix anything.** This agent only audits and reports.
- **Do not skip checks.** Run every section even if early checks find issues.
- **Be specific.** Always include file paths and line numbers.
- **Cross-reference BLI-24.** Compare your findings against the known audit (run `npx linear issue view BLI-24` to get current state).
- **Flag new findings.** Any issue NOT in BLI-24 should be marked as `[NEW]`.
- **No false positives.** Verify each finding by reading the actual code before reporting. Don't report based on grep matches alone.
