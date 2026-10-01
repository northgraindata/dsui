# Preserve type safety

- Represent valid states in types where practical.
- Prefer narrowing and validation over unsafe casts.
- Do not use `any` to bypass a type error; model the value or boundary instead.
- Keep type-only imports explicit when supported by local conventions.
- Fix the underlying type mismatch rather than suppressing diagnostics.
