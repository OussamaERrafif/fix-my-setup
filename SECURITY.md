# Security Policy

Fix My Setup runs on developer machines and reads potentially sensitive
environment data, so security is a first-class concern.

## Design guarantees

- **Diagnostic mode never mutates the system.** Running `fix-my-setup` (or with
  `--safe`) only reads state and prints suggestions. No files, processes,
  permissions, shell profiles, or environment variables are changed.
- **No automatic destructive actions — ever.** The tool will not delete files,
  kill processes, uninstall software, run as administrator, or modify
  system-wide configuration on its own.
- **Applied fixes are opt-in, previewed, and low-risk.** `--apply` runs only
  fixes registered as `risk: "safe"`, and each one prints exactly what it will
  change and asks for confirmation (unless `--yes` is passed for harmless
  operations).
- **Secrets are never printed.** Environment-file diagnostics read only variable
  **names** and whether a value is empty — never the values themselves.
- **Reports are sanitized and local.** `report`/`--report` output is scrubbed of
  usernames, home/project paths, tokens, credentials-in-URLs, emails, and IPs,
  and is written to disk only. Nothing is uploaded.
- **Commands are executed without a shell** (`shell: false`) using fixed,
  internal argument lists, avoiding shell-injection surfaces. On Windows, batch
  shims (`npm`/`npx`) are run via `cmd.exe` with explicit quoting and verbatim
  arguments.

## What the sanitizer redacts

| Sensitive data                     | Placeholder  |
| ---------------------------------- | ------------ |
| Home directory path                | `<HOME>`     |
| Current project path               | `<PROJECT>`  |
| OS username                        | `<USER>`     |
| Tokens / API keys / password pairs | `<REDACTED>` |
| Credentials embedded in URLs       | `<REDACTED>` |
| Email addresses                    | `<EMAIL>`    |
| Non-loopback IPv4 addresses        | `<IP>`       |

Always review a report before sharing it. If you find data that should have been
redacted, please report it (see below) — that is a security bug.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's
private [**Report a vulnerability**](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
flow on this repository, or email the maintainers listed in the repository
metadata.

We aim to acknowledge reports within a few days and will coordinate a fix and
disclosure timeline with you.

## Supported versions

During the `0.x` pre-1.0 phase, only the latest published version receives
security fixes.
