# DSUI Auth (Pro)

Teams, per-team service access, and email/password sign-in for DSUI.

Installing this plugin puts DSUI behind a login. Without it, DSUI runs as a
single local operator with full access — which is the right default for a
developer tool on a laptop, and the wrong one on a shared host.

## What it does

- **Email and password sign-in**, with self-service registration closed by
  default.
- **Teams**, and a per-team grant of which DSUI services a team can see. A
  member of the `data` team granted `warehouse` sees `warehouse` and nothing
  else.
- **Roles** (`owner`, `admin`, `operator`, `viewer`) that mirror the host's.
  They set the ceiling on what a principal may do; team grants can only narrow
  it, never widen it.

## Install

Add it to `dsui.yaml`. The plugin is `security: true`, so it must also be
`critical: true` — DSUI refuses to start rather than fall back to running
unauthenticated.

```yaml
plugins:
  auth-pro:
    package: "@northgraindata/dsui-plugin-auth-pro"
    browserBundle: "@northgraindata/dsui-plugin-auth-pro/browser"
    enabled: true
    critical: true
    config:
      # The only way in while registration is closed. Created once, on an empty
      # database; a later restart never recreates it.
      bootstrap:
        email: you@example.com
        password: a-long-passphrase
        role: owner

      # Off by default. Turning it on lets anyone who can reach DSUI create an
      # account — they still see no services until you grant them a role and a
      # team.
      registration:
        enabled: false
        minPasswordLength: 12

      session:
        maxAgeDays: 30

      # Keep the signing secret out of the file:
      #   secret: "${DSUI_AUTH_SECRET}"
      # Absent, the plugin generates one and keeps it beside its database.
      # secret: "${DSUI_AUTH_SECRET}"
```

Then open `/plugins/auth-pro/login`.

## Registration

Closed by default, because installing the plugin should not by itself open
DSUI to anyone who can reach the port. Turning it on still does not grant
access: a new account starts as a `viewer` on no teams, which means it can see
no services at all.

## Managing teams

Procedures, all requiring `manage`, so only an owner or admin can call them:

| Procedure | Input | Purpose |
|---|---|---|
| `create-team` | `{ id, name }` | Create a team |
| `add-member` | `{ teamId, userId }` | Add a user to a team |
| `remove-member` | `{ teamId, userId }` | Remove them |
| `grant-service` | `{ teamId, serviceId }` | Let the team see a service |
| `revoke-service` | `{ teamId, serviceId }` | Take it away |
| `teams` | `{}` | List teams, their members and their services |
| `set-role` | `{ userId, role }` | Change a user's role |

`userId` is the principal id from `GET /api/v1/auth/me` after signing in as that
user. `grant-service` rejects a service the host does not know, so a typo fails
instead of quietly granting nothing.

## Where it keeps its data

Everything lives in `<dataDir>/plugins/auth-pro/`: `auth.sqlite` (Better Auth's
users and sessions, plus this plugin's teams and grants) and the generated
signing secret. The host has no migration and no table for any of it, and never
reads it.

Because the secret is generated rather than configured, sessions do not survive
deleting that directory. Supply `secret` explicitly to keep sessions valid
across a wipe.

## Notes and limits

- **Better Auth.** Sessions, password hashing and sign-up come from
  [`better-auth`](https://better-auth.com) (MIT), which also owns the shape of
  its own tables — the plugin asks it for the migration plan rather than
  shipping SQL that would rot against the installed version.
- **Teams are this plugin's, not Better Auth's.** Its `organization` plugin
  models permissions per organization, but DSUI authorizes against its own
  resources, so translating between the two on every request would be a
  permanent tax. This plugin keeps `teams`, `team_members` and
  `service_grants` in DSUI's vocabulary.
- **No email.** Verification and password reset are off, because DSUI ships no
  mailer. Both are worth adding before this faces the public internet.
- **No `shell: "bare"` support in the web app yet.** The login page declares it,
  and the server honours it, but the web app still renders plugin pages inside
  the app shell, so the sign-in screen currently appears with the sidebar
  around it.