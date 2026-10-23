---
"@northgraindata/dsui-plugin-sdk": minor
"@northgraindata/dsui-adapter-sdk": minor
---

Add optional bounded plugin execution scopes, revision-bound delegation contracts,
fresh identity resolution, service refresh discovery and job idempotency/cancellation.
Implement a serializable code-editor change action and its shared browser view.
Older plugins retain their existing behavior; consumers requiring execution scopes
must explicitly reject hosts without that capability.

Preserve resource access policy metadata. SQL-policy resources require execute
permission on supporting hosts, independently of their read refresh strategy.

Execution audiences support provider-owned claims without a host-role filter,
including custom team membership. Grant management uses authenticated host
authorization; the unauthenticated local core principal is not a plugin session.
