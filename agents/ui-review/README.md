# Page review

Adapter and application pages move to the [UI conventions](../rules/ui-conventions.md) one at a time.
The maintainer decides at each step.
Nobody starts the next page before the current one is accepted.

## Steps for one page

1. **Show.** Open the page in the gallery, with and without the shell, and capture it at full and split width.
2. **List.** Name each broken rule by number, with what a person sees. List separately anything the rules do not cover.
3. **Propose.** Describe the changes, including any rule you would change.
4. **Approve.** Wait for the maintainer to accept, drop or edit each item.
5. **Change.** Implement only the accepted items. A fix in a shared component affects other pages: name them.
6. **Compare.** Show before and after, including the other affected pages, and run `bun run test:ui`.
7. **Accept.** The maintainer accepts the page. Only then mark it done in the [ledger](pages.md).

One page is one commit, or a few, so it can be reverted on its own.
Follow [Changing a convention](../rules/ui-conventions.md#changing-a-convention) when a rule needs to move.
