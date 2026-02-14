# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes                |
| < 2.0   | No                 |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Please email security concerns directly to **eddie@efsanjuan.com** with:

- A description of the vulnerability
- Steps to reproduce or a proof-of-concept
- The affected version(s)
- Any suggested remediation (optional)

### Response Timeline

- **Acknowledgment:** Within 48 hours of your report.
- **Fix target:** Within 7 days for confirmed vulnerabilities.
- **Disclosure:** Coordinated with the reporter once a fix is released.

### What Counts as a Security Issue

- Data leaks (session recordings, transcripts, or settings exposed unintentionally)
- Code injection (XSS, command injection, or unsafe eval paths)
- Permission escalation (bypassing macOS permission checks)
- Credential exposure (API keys written to logs, unencrypted storage, or clipboard leaks)

### Credit

Security reporters will be credited in the CHANGELOG unless they prefer to remain anonymous. Let us know your preference when reporting.
