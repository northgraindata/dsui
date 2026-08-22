# Security policy

## Supported versions

Security fixes are applied to the latest released minor version while dsui remains pre-1.0.

## Reporting a vulnerability

Do not open a public issue. Use GitHub private vulnerability reporting for `northgraindata/dsui`, including affected version, impact, reproduction steps, and any suggested mitigation. Northgrain Data will acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Deployment guidance

- Configure `DSUI_MASTER_KEY` whenever UI-managed credentials or enterprise authentication are enabled.
- Put internet-facing deployments behind TLS and configure trusted proxy headers explicitly.
- Use authentication outside a private local environment.
- Run the container non-root with a read-only root filesystem and no Docker socket.
- Mount `dsui.yaml` read-only and inject secrets through the environment or a secret manager.
- Treat community adapters as trusted third-party server code. Integrity verifies identity, not safety.
- Pin every external adapter to an exact package version or full Git commit and verify its source, license, provenance, and network access.

Resolved credentials must never be included in bug reports, diagnostics, or logs.
