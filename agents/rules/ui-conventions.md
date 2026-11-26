# UI conventions

How DSUI behaves and looks, beyond [layout](ui-layout.md).
A maintainer approves every rule and every change to a rule.

**Most rules are targets, not a description of the current UI.**
The `Enforced by` line says who should hold a rule once it is built.
`Planned` means nothing enforces it yet.
A rule is enforced by a component where possible, so that an adapter author cannot get it wrong.

## Actions and feedback

### R1. Stable size

Actions, errors and loading never change a component's size or move its neighbors.
A message that has no reserved space goes to a toast or a tooltip.
Enforced by: components and layout tests. Planned.

### R2. Action results

A button shows its pending, success and error states.
The message goes to a toast, built with Sonner.
An error toast stays until dismissed.
A success toast appears only when the effect is not visible on screen.
A field error stays next to its field, in reserved space.
Enforced by: components. Planned.

### R3. No double submit

Every action has a pending state that blocks a second submit, and handles a thrown error.
Enforced by: components. Planned.

### R4. Confirmations

A confirmation uses the DSUI alert dialog, never `window.confirm` or `window.prompt`.
It names the object, and its button repeats the verb, such as "Pause DAG".
It states side effects.
For example, Airflow's trigger also unpauses a paused DAG.
Confirm: delete, drop, terminate, cancel, stop, pause, unpause, suspend, resume, clear and trigger.
Do not confirm: refresh, test, or running a read-only query.
SQL that changes data is not covered yet.
Enforced by: components, and a lint rule against native dialogs. Planned.

### R5. Risk is declared

An action declares its risk, such as `safe`, `confirm` or `destructive`.
The UI picks the dialog and the colour from it.
Enforced by: the SDK type and components. Planned.

### R6. Refresh after an action

Data updates after an action without a reload, and without losing filters or scroll position.
Enforced by: runtime and tests. Partly done: polled resources refresh after an action.

## Forms and navigation

### R7. Create and edit in a modal

Create and edit open in a modal.
Remove `new` and `edit` pages; breaking changes are acceptable for this.
A large editor, such as a dashboard written in SQL, stays a page.
A modal has an option that says whether a click outside closes it.
The default is yes for read-only content, and no for forms and confirmations.
Enforced by: components and review. Planned.

### R8. Form behaviour

Errors appear at their fields.
Submit is disabled while nothing changed.
Closing a form with unsaved changes asks first.
Enforced by: components. Planned.

### R9. Three kinds of link

| Kind | Example | Looks like |
| --- | --- | --- |
| Navigation | "View all", a name in a table | a plain link |
| Object reference | a GitHub pull request, a DAG, a plugin or adapter | a chip with logo and name, details in a tooltip |
| External | any other address | a plain link with an external icon |

A button runs an action.
A link goes somewhere.
Filters and tabs live in the URL.
A reference to a DSUI object takes its logo and address from the adapter or plugin.
A provider registry recognizes external services, and plugins can add providers.
Logo and identifier come from the URL alone.
Titles and status appear only when an integration supplies them through the server.
The browser never fetches an unknown page to preview it.
Enforced by: a `Reference` component and review. Planned.

### R10. Action hierarchy

A view has at most one primary action.
Show only the actions that apply to the current state.
Secondary actions go to a menu, with destructive ones last and marked as such.
Two equally frequent actions may both stay visible.
Enforced by: components and review. Planned.

## Icons, tooltips and badges

### R11. One icon registry

Icons come from one registry.
DSUI's own icons live in a separate part of it, on the same grid, stroke and sizes.
Brand logos are kept apart.
Do not use inline SVG or text characters as icons.
Enforced by: the registry type and a lint rule. Planned.

### R12. One meaning, one icon

Edit, delete, run, refresh and other shared meanings use the same icon everywhere.
Enforced by: named registry entries and review. Planned.

### R13. Informative icons have a tooltip

An icon that carries information, such as a dbt model type, has a tooltip.
So does every button that shows only an icon.
The tooltip works from the keyboard, and the control has an accessible name.
Enforced by: components that require a label. Planned.

### R14. Badges are for state

Use a badge for state or a short label.
Show the type of an object with an icon.
Enforced by: review. Planned.

### R15. One status vocabulary

A state has the same colour, shape and name everywhere.
Colour is never the only signal.
Enforced by: a shared status map. Planned.

## States and content

### R16. Four states and retry

A data view has loading, empty, error and data states.
Loading is a skeleton with the final size.
With no data yet, an error shows in place, at the component's size.
Offer retry only for a temporary failure, and only when repeating cannot do the work twice.
A permanent failure, such as missing permission, explains itself or offers a useful step instead.
A failed action may offer retry in its toast.
One failure has one toast, which updates.
A resource may declare an optional retry policy.
Actions are never retried automatically.
Enforced by: components, and an error type that says whether a failure is temporary. Planned.

### R17. Quiet background refresh

While refreshing, current data stays on screen.
After a failed refresh the last data stays, marked as stale.
The marker must not shift the layout: it uses a slot reserved in the header, even while empty.
It is an icon whose tooltip gives the time and the reason.
Without a header, the marker overlays a corner and covers no content or control.
A failed poll does not raise a toast each time.
Enforced by: components, and a test comparing positions before and after a failure. Planned.

### R18. No raw data

Do not show JSON or technical keys, such as `uniqueId`, as ordinary content.
Enforced by: review. Planned.

### R19. One formatting layer

Dates, durations, numbers and sizes use shared formatting that follows the user's settings.
The full date is in a tooltip.
Enforced by: shared helpers and a lint rule. Planned.

### R20. Long values

Truncate in tables and give the full value in a tooltip.
IDs and paths can be copied.
Outside tables, values wrap.
Enforced by: components and layout tests. Partly done: layout tests catch overflow.

### R21. Wording

Actions start with a verb.
Use sentence case.
Use one name for one concept.
Enforced by: review.

## Appearance

### R22. Shared controls only

Use the shared button, input, select and menu components.
Primitives with hard behaviour are built on Radix, behind our own variants. See the [Radix decision](../ui-review/radix-spike.md).
An extension receives shared components from the host, as `ui`, and never imports them.
Enforced by: a lint rule. Planned.

### R23. Small scale, open to growth

Start with a small set of text sizes, radii and control heights, and hold to it to keep views minimal.
Views must not become generic: when one needs a new style, add it as a named token with a short reason.
Do not write one-off values in a component.
The scale does not limit layout.
Enforced by: tokens and Stylelint. Planned.

### R24. No extra frames

Do not nest cards.
A title alone does not get its own card.
Enforced by: review.

### R25. Nothing twice, nothing idle

No duplicate headings.
No control that can do nothing, such as "Clear all" without a filter.
Enforced by: components and review. Planned.

### R26. Selection means something

Only the selected item looks selected.
Hover and focus look different from selection.
Enforced by: components and review. Planned.

## Open decisions

- How to confirm SQL that changes data.

## Changing a convention

Conventions and pages improve each other.
Reviewing a page may show that a rule is wrong, missing or too strict.

1. Describe the case and propose the new wording. Do not edit the rule yet.
2. Wait for the maintainer to approve it.
3. Change the rule, add a line to the log below, and list reviewed pages that need another look in the [page ledger](../ui-review/pages.md).

## Change log

| Date | Rules | Change |
| --- | --- | --- |
| 2026-11-26 | R1-R26 | First agreed version. |
| 2026-11-26 | R22 | Radix accepted for primitives with hard behaviour; extensions receive them as `ui`. |
