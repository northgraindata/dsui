---
"@northgraindata/dsui-adapter-postgresql": minor
"@northgraindata/dsui-adapter-s3": minor
---

Expose generic parameterized, database-enforced read-only PostgreSQL query rows,
optional SQL action parameters/affected-row checks, and bounded S3 file uploads
with unique keys under a configured prefix. SQL resources declare `policy: sql`
and require execute permission through HTTP, plugin calls and bounded scopes. Existing worksheet and upload actions
retain their behavior. These capabilities support declarative Internal Apps
without separate service integrations or embedded credentials.
