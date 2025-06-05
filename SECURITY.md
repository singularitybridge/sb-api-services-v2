# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

The SB Agent Portal team and community take security bugs seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

To report a security issue, please use the GitHub Security Advisory ["Report a Vulnerability"](../../security/advisories/new) tab.

The team will send a response indicating the next steps in handling your report. After the initial reply to your report, the security team will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

Report security bugs in third-party modules to the person or team maintaining the module.

## Security Best Practices

When deploying SB Agent Portal in production:

1. **Environment Variables**: Never commit API keys, tokens, or credentials to version control
2. **Authentication**: Use strong JWT secrets and rotate them regularly
3. **Database**: Use strong MongoDB connection strings with authentication
4. **HTTPS**: Always use HTTPS in production
5. **Dependencies**: Regularly update dependencies to patch known vulnerabilities
6. **Rate Limiting**: Configure appropriate rate limits for your API endpoints
7. **Input Validation**: Validate all user inputs and API parameters
8. **Logging**: Monitor and log security-relevant events

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. We recommend:

- Subscribe to repository notifications to be notified of security updates
- Regularly update to the latest version
- Review the changelog for security-related fixes

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all releases still under maintenance
4. Release new versions as soon as possible

## Comments on this Policy

If you have suggestions on how this process could be improved please submit a pull request.
