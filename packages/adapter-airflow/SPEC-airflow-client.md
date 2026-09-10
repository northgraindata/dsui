# Spec: Airflow Client

## Objective

Provide a per-adapter-instance client for Airflow 2.10.x's stable `/api/v1` API
and Airflow 3.x's stable `/api/v2` API. The client must use Basic credentials
for Airflow 2 and a bearer JWT for Airflow 3, URL-encode identifiers, bound
response bytes and list results, validate every provider response, propagate
cancellation, and surface secret-free errors.

## Tech Stack

TypeScript, Bun's `fetch`, Zod from `@northgraindata/dsui-adapter-sdk`, and no
new dependencies.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/context.ts`: versioned connection schemas and public domain/client contracts.
- `src/client.ts`: versioned HTTP transport, endpoint calls, and boundary parsing.
- `test/client.test.ts`: request, validation, cancellation, and error behavior.

## Code Style

```ts
async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(new URL(`${apiRoot}/${path}`, baseUrl), { signal, headers });
  if (!response.ok) throw await toAirflowError(response);
  return schema.parse(await response.json());
}
```

Use named domain types, explicit request bodies, camelCase inside the adapter,
and provider/version-specific field names only at the parsing boundary.

## Testing Strategy

Write transport tests before implementation. Stub only `fetch`; assert both API
roots and authentication schemes, request method, URL, headers, body, response
mapping, malformed-response failure, non-success error redaction, and disposal
abort behavior.

## Boundaries

- Always: normalize the base URL, encode path/query values, validate responses,
  select API/authentication explicitly from the connection method, and cap list
  endpoints at 100.
- Ask first: add another authentication method or dependency.
- Never: log or interpolate credentials, retry mutations, probe API versions
  with user credentials, or accept malformed provider payloads as empty success.

## Success Criteria

- Every required read and mutation has a typed client method for Airflow 2.10
  and Airflow 3.
- Airflow 2 response differences (DAG/task fields, string logs, and datasets)
  normalize into the existing adapter domain models.
- TaskFlow-decorated Python tasks use the same user-facing `Task` operator label
  whether the provider reports Airflow 2's `_PythonDecoratedOperator` or
  Airflow 3's `@task`; distinct classic and provider operators remain named.
- HTTP failures include status but never expose an untrusted provider body or
  bearer token.
- Malformed JSON and schemas fail explicitly.
- Disposing the owning instance aborts in-flight requests.

## Open Questions

None. Explicit connection methods, Basic authentication for Airflow 2, bearer
authentication for Airflow 3, and a 100-row bound are approved.
