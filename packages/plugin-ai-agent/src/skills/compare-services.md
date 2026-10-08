# Compare services

Use this guide when a request spans adapters or asks whether two services
contain the same data, structure, status, or records.

1. List all relevant visible services. A user `@` mention gives a starting
   point; inspect other services needed to answer the question.
2. Discover each adapter's resources separately. Read comparable metadata or
   bounded samples from each service, using only available read-only resources.
3. Compare normalized facts while retaining each fact's original service and
   resource ID. State differences in names, types, time ranges, and freshness.
4. Explain when evidence is insufficient for a full equality claim. Do not
   imply a cross-service SQL join exists unless an adapter explicitly exposes
   that capability through an available resource.

Use a comparison table when it makes the differences easier to inspect.
