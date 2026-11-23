# DSUI Community & Discord Architecture Plan

**Linear Task:** DSUI-115  
**Issue Reference:** https://github.com/northgraindata/dsui/issues/67  

This proposal defines the channel structure, roles, permissions, safety guidelines, and launch checklist for the DSUI user and developer community.

---

## 1. Guiding Principles

1. **GitHub First**: Core development, issue tracking, and code reviews remain strictly on GitHub. Joining Discord is optional and is **never required** to contribute to DSUI.
2. **Signal Over Noise**: Maintain minimal, focused channels to avoid conversational fragmentation in an early-stage community.
3. **Safety & Inclusion**: All spaces strictly enforce the DSUI [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 2. Channel Architecture

| Category | Channel | Type | Purpose | Post Permission |
| :--- | :--- | :--- | :--- | :--- |
| **WELCOME** | `#welcome-and-rules` | Read-only | Server rules, quickstart links, Code of Conduct, and GitHub repo pointer. | Maintainers only |
| **WELCOME** | `#announcements` | Read-only | Release notes, breaking changes, and major project updates. | Maintainers only |
| **DISCUSSION** | `#general` | Chat | General discussions about DSUI and data engineering stacks. | Members |
| **DISCUSSION** | `#support` | Forum / Threaded | Troubleshooting installation, configuration, and connection errors. | Members |
| **DEVELOPMENT** | `#contributors` | Chat | Discussions on open issues, PRs, and architectural improvements. | Contributors & Maintainers |
| **DEVELOPMENT** | `#adapters` | Chat | Dedicated to authors building or maintaining adapters with the Adapter SDK. | Members |
| **COMMUNITY** | `#showcase` | Media / Chat | Demos of community adapters, deployment setups, and custom plugins. | Members |

---

## 3. Roles & Permissions Matrix

| Permission | `@everyone` | `@Member` (Verified) | `@Contributor` (Merged PR) | `@Moderator` | `@Maintainer` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View channels & read history | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send messages in discussion channels | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create forum threads / support posts | ❌ | ✅ | ✅ | ✅ | ✅ |
| Attach files & embed links | ❌ | ✅ (Level 1+) | ✅ | ✅ | ✅ |
| Mention `@here` / `@everyone` | ❌ | ❌ | ❌ | ❌ | ✅ |
| Post in `#announcements` | ❌ | ❌ | ❌ | ❌ | ✅ |
| Timeout / Kick / Ban users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage channels & integrations | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Member Onboarding Journey

1. **Join & Verification**:
   * New members land on `#welcome-and-rules`.
   * Must accept server rules via Discord Community Onboarding screening.
   * AutoMod scans initial messages to mitigate raid bots and spam links.
2. **First Steps & Pinned Resources**:
   * Official Website: `https://dsui.northgraindata.com`
   * Documentation: `https://dsui.northgraindata.com/docs`
   * GitHub Repository: `https://github.com/northgraindata/dsui`
   * Good First Issues: `https://github.com/northgraindata/dsui/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`
3. **Bug & Issue Direction**:
   * Discord is for informal troubleshooting; all confirmed bugs, feature requests, and regressions must be directed to [GitHub Issues](https://github.com/northgraindata/dsui/issues) using the standard issue template.

---

## 5. Moderation & Escalation Protocol

* **Rules Alignment**: The server operates strictly under [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
* **Escalation Path**:
  * Level 1 (Spam / Self-promotion): Message deletion and informal verbal warning.
  * Level 2 (Harassment / Trolling): 24-hour timeout + moderator log.
  * Level 3 (Severe / Repeat Violations): Permanent ban by Maintainers and report to GitHub/Discord Trust & Safety if applicable.
* **Confidential Reporting**: Users can message `@Moderator` or email `conduct@northgraindata.com`.

---

## 6. GitHub Bot & Webhook Integration

* **Webhook Channel**: `#announcements`
* **Trigger Events**: **Releases Only** (`release: published`).
* **Noise Mitigation**: PR updates, issue comments, and commit pushes must **not** post to public chat channels to keep notification volume manageable for users.

---

## 7. Launch Checklist for Maintainers

- [ ] Enable Community Features in Discord Server Settings.
- [ ] Configure Onboarding questions and rule acceptance gate.
- [ ] Create roles (`Member`, `Contributor`, `Moderator`, `Maintainer`) according to Section 3.
- [ ] Configure channels and lock permissions for `#welcome-and-rules` and `#announcements`.
- [ ] Enable Discord AutoMod (Block mentions spam, block known malicious links).
- [ ] Set up GitHub webhook in `#announcements` scoped strictly to published releases.
- [ ] Add the permanent Discord invite link to `README.md` and docs.
