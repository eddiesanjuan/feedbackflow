# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes                |
| < 2.0   | No                 |

Only the latest release in the 2.x line receives security patches. Upgrade to the latest version before reporting.

## Reporting a Vulnerability

**Do not create public GitHub issues for security vulnerabilities.**

Email **eddie@efsanjuan.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You may also use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) if you prefer.

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Fix timeline provided**: Within 7 days
- **Fix target**: Within 30 days for critical issues
- **Public disclosure**: 90 days after report (coordinated disclosure)

## What Qualifies as a Security Issue

**In scope:**

- Data leaks (audio recordings, screenshots, transcriptions, API keys)
- Code injection or remote code execution
- Permission escalation beyond granted macOS entitlements
- Authentication or authorization bypass
- Clipboard injection attacks
- Insecure storage of sensitive data (API keys, credentials)

**Out of scope:**

- Social engineering attacks
- Physical access attacks
- Vulnerabilities in upstream dependencies (report those to the dependency maintainer)
- Denial of service against a local desktop application

## Credit Policy

Security reporters will be credited by name in the CHANGELOG for the release that includes the fix, unless they prefer to remain anonymous. Let us know your preference when reporting.

## Safe Harbor

We will not take legal action against researchers who:

- Act in good faith
- Avoid privacy violations
- Do not exploit vulnerabilities beyond proof-of-concept
- Report vulnerabilities promptly
- Allow 90 days before public disclosure
