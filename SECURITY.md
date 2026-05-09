# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest `main` | ✅ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email [security@gitvisor.dev](mailto:security@gitvisor.dev) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 14 days.

## Scope

- SQL injection / data exfiltration via API
- Authentication bypass
- Webhook signature bypass
- Privilege escalation between user tenants
- Secrets exposure (GitHub secret values must never be stored or logged)
