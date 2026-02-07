# Security Policy

## Supported Versions
The following table outlines the versions of BitQuest currently receiving security updates. We recommend always running the latest stable release.

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in BitQuest, please report it responsibly.

### How to Report

**DO NOT** create a public issue for security vulnerabilities.

Instead:

1. **Send an email** to contact.ibrahima.fall@gmail.com (or create a Security Advisory on GitHub)
2. **Include**:
   - Detailed description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix if you have one

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Regular updates**: Weekly until resolution
- **Fix**: Depending on severity (critical: < 7 days, high: < 30 days)

### Responsible Disclosure

We ask that you:

- Give us reasonable time to fix the vulnerability before any public disclosure
- Do not exploit the vulnerability beyond what is necessary for demonstration
- Do not access, modify, or delete data that doesn't belong to you

### Recognition

We publicly acknowledge security researchers who report vulnerabilities responsibly (unless you prefer to remain anonymous).

## Security Best Practices

### For Users

- Use strong and unique passwords
- Never share your credentials
- Enable two-factor authentication (when available)
- Keep your browser up to date

### For Developers

- Never commit secrets (API keys, passwords, etc.)
- Use environment variables for sensitive information
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Keep dependencies up to date

## Security Scope

### In Scope

- SQL Injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Authentication and session management
- Sensitive data exposure
- Broken access control

### Out of Scope

- Brute force attacks (rate limiting in place)
- Vulnerabilities in third-party dependencies (report them directly to maintainers)
- Issues requiring physical access to the device
- Social engineering

## Security Updates

Security updates are published as soon as possible after discovery and fix of a vulnerability. We recommend:

- Monitoring GitHub releases
- Subscribing to security notifications
- Regularly updating your installation

## Contact

For any security-related questions:
- Email: contact.ibrahima.fall@gmail.com

---

Thank you for helping keep BitQuest safe for everyone! 
