# Security Policy

## Supported versions

Security fixes are accepted against the `main` branch of [YukaC/MuniDgoSaaS](https://github.com/YukaC/MuniDgoSaaS).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs that could put users or operators at risk.

Send a private report to **agusyuk25@gmail.com** with:

- description of the issue
- steps to reproduce
- affected version or commit
- impact assessment and any suggested fix

We aim to acknowledge reports within **7 days**. Please do not disclose publicly until a fix is available.

## Operator responsibilities

If you deploy this system:

- never commit `.env`, database passwords, or JWT secrets
- keep Python dependencies updated (`pip install -r requirements.txt` / review advisories)
- restrict network access to the admin API in production
- use strong credentials and least-privilege database users
