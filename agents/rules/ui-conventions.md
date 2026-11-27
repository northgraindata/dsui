# UI conventions

How DSUI behaves and looks, beyond [layout](ui-layout.md).
A maintainer approves every rule and every change to a rule.

**Most rules are targets, not a description of the current UI.**
The `Enforced by` line says who should hold a rule once it is built.
`Planned` means nothing enforces it yet.
A rule is enforced by a component where possible, so that an adapter author cannot get it wrong.

## Reference design

The Airflow redesign in `apps/gallery/src/prototype/airflow` is the look to follow.
Run `bun run gallery:dev`, open `/services/airflow?design=new`, and switch between Old and New.

It is a prototype on invented data, not a model for code.
It still breaks some rules: it draws inline SVG icons (R11), writes raw colors, has its own tooltip, and its connection modal has no header icon (R44).
Copy what a person sees and does, then build it from shared components.

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
In detail panels, identifier keys get a readable label, and an adapter may pass written labels instead.
Enforced by: review. Planned.

### R19. One formatting layer

Dates, durations, numbers and sizes use shared formatting that follows the user's settings.
The full date is in a tooltip.
Database content, such as previews and query results, is shown as stored.
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
A control hidden for this reason keeps its space, so nothing moves.
Enforced by: components and review. Planned.

### R26. Selection means something

Only the selected item looks selected.
Hover and focus look different from selection.
Enforced by: components and review. Planned.

## Fidelity to the source

### R27. Mirror the tool

An adapter shows and does what the underlying tool shows and does.
Keep the tool's names and the patterns its users know, such as Airflow's All, Active and Paused tabs and its run grid.
Do not add concepts the tool does not have, such as an expected freshness for an Airflow asset.
Enforced by: review.

### R28. Only real data

Check in the tool's API specification that every value, filter and count exists, in each supported version, before you design with it.
If a value needs extra requests, or is a guess, such as an error line picked from a log, say so in the proposal, and keep the source of a guess one click away.
Enforced by: review.

### R29. Every state

Support every state in the tool's API, kept in one table with a test that compares it with the specification.
A state the table does not know keeps its own name and a neutral look.
It must never look like "not run" or success.
A view that mixes states has a legend of the states on screen.
Enforced by: a shared status map and a test. Partly done: the Airflow adapter has the table and test, and its graph still sets its own colors.

## Lists at scale

Design every list for a company with hundreds of records, for example 300 DAGs and thousands of events.

### R30. Pages come from the server

A list that can grow without limit fetches one page at a time, and search and filters are part of the request.
Never cut a list off without saying so, and request the order explicitly, such as newest first.
Where the tool cannot search or filter, say what the view does instead.
Enforced by: `paged` on `List` and `Table`, and review. Partly done.

### R31. Find things

A large list has search and the filters people need, above the list.
The main states are tabs or segments with counts, not subpages in the sidebar.
Opening a record and coming back keeps the filters and the page.
Enforced by: components and tests. Planned.

### R32. Summaries stay short

A summary shows a few items, at most three when each is tall, and links to the full filtered list.
It looks right with none, one and hundreds.
Do not add lists of recent items to the sidebar.
Enforced by: components and review. Planned.

### R33. The same data, the same view

A record's own tab reuses the full page's view, without the columns that would not change.
For example, a DAG's activity is the activity log filtered to that DAG.
Enforced by: shared components and review. Planned.

### R34. Rows stay one height

A row shows two tags, then a "+N" chip that lists the rest on hover and on keyboard focus.
Tags are styled chips, never plain text.
Row actions are icon buttons at the end of the row, such as pause or play, not switches.
A row's state is a dot at its start.
Enforced by: components. Planned.

## Overview pages

### R35. Problems first, with their cause

An overview starts with what needs attention.
A failure shows what failed, the most telling error line, the attempt and the time, with the log one click away.
Nothing is expanded until the person asks.
The problems sit together in one card with a tone, set apart from the rest of the page.
Enforced by: review.

### R36. Design the healthy state

Design what a page shows when nothing is wrong, not only when something is.
It says so plainly and offers the next useful step.
A page title does not depend on a count.
Enforced by: review, with a gallery control that shows both. Planned.

## Time and history

### R37. Real times

Show clock times, such as "Today 13:02", and clock times on chart axes, not "12 h ago".
Where runs are inspected, show seconds, and durations as `HH:MM:SS`.
Do not add an "as of" line that tells the person nothing.
A daily schedule keeps its hour across a clock change.
Enforced by: shared helpers. Planned.

### R38. Dense history is readable

A strip or grid of runs uses narrow columns that sit close together.
Every mark answers on hover with its state, start time with seconds, and duration.
The time axis labels a few columns, plus the hovered and the selected one, without overlap.
A duration scale and round tick marks show how long things took.
A strip is one tab stop with a summary label, not one for each mark.
Enforced by: shared components and tests. Planned.

## Navigation and identity

### R39. Grouped sidebar

An adapter's sidebar groups pages under short headings, such as Monitor and Configure.
Each page has its own icon.
A count appears only for something that needs attention.
Enforced by: an adapter navigation declaration in the SDK. Planned.

### R40. Page art

Sidebar entries and page headers use DSUI's glossy blue art, generated as one set so the style matches.
This art is separate from the line icons of R11.
Show it in full color.
Enforced by: review.

### R41. Brands

A well-known system shows its real logo, on a tile tinted with its color.
Anything else, protocols included, gets one generic mark and color.
Never fake a logo with letters.
Record where each logo came from, and check the owner's brand rules before shipping it.
Enforced by: a shared brand registry. Planned.

## Controls and content

### R42. Lively selects

An option that stands for something with an identity shows its logo or icon.
Labels are written for people, never raw values.
Pick one naming convention for each set, such as the vendor's full product name.
The menu is compact, fits its longest option, and its trigger matches the inputs beside it.
Enforced by: the shared select. Partly done: sizing and style.

### R43. Headers earn their text

A header has no description that restates its title.
Keep a second line only when it is data, such as a DAG's description or an asset's URI.
Put an explanation that matters in an empty state.
Enforced by: review.

### R44. Modals are laid out

A modal has an icon beside its title.
Related fields sit side by side, in named groups, and rare fields are collapsed.
The input control fits the data, such as a select for a type.
Enforced by: form layout components. Planned.

### R45. Code is shown as code

A code view is one frame with line numbers and syntax coloring.
Its top bar gives the facts about the file, such as its path and when it was last parsed, and a copy button.
Enforced by: a shared code component. Planned.

### R46. Only what the reader can use

Text on screen helps the reader decide or act.
It does not describe how the data was fetched or built, such as which part of a file the reader parsed, who decompressed it or which link serves it.
Say what is missing in the reader's terms, such as "First 100 rows", and say what changes a result, such as a search that covers only part of a file.
Do not add a label whose only job is to hold an explanation in a tooltip.
List keyboard shortcuts in one readable place behind a keyboard button and the `?` key.
Enforced by: review.

## Known gaps

- A toast raised while a native `<dialog>` is open, such as the connection dialog, is drawn under it. Moving that dialog to the Radix modal fixes it.

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
| 2026-11-27 | R27-R45 | Added from the maintainer's feedback on the Airflow redesign, which is now the reference design. Added by the agent at the maintainer's invitation, so each rule still awaits their reading. |
| 2026-11-27 | R18, R19, R25 | Clarified generated labels, stored database content and the space of hidden controls. |
| 2026-11-27 | R46 | Added at the maintainer's request after the S3 prototype showed notes about how files were read. |
