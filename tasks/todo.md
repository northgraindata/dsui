# Extensions implementation

- [ ] Session pool: isolation, sequential execution, failure recovery, capacity,
  and disposal tests pass; wire service identities and lifecycle cleanup.
- [ ] Subprocess sessions: bounded line transport, correlation, timeout/exit
  handling, and cleanup; integration test state across multiple requests.
- [ ] DuckDB restart actions: confirmation required, built-ins rejected, real
  instance state verified after restart; SDK/adapter tests and typechecks.
- [ ] Generic catalog/detail contracts: validate/serialize and document; contract
  tests establish valid and invalid inputs.
- [ ] Generic renderer: list filters/search, detail tabs, action confirmation,
  status refresh, copy feedback, loading/error/empty states; browser tests.
- [ ] DuckDB pages and metadata: truthful values and documented content; list
  links to details and related-extension actions operate correctly.
- [ ] Reference fidelity: inspect desktop and responsive screenshots, keyboard
  operation, console errors; preserve unrelated workspace work.
- [ ] Handoff: root check/build, focused verification, final diff review; report
  actual outcomes and any remaining limitations.
