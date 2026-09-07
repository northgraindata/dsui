# DSUI adapter SDK documentation writing guide

This guide keeps every page in `docs/` consistent. It is not a doc page.
Files under `_meta/` stay out of the doc map and out of link checks for
frontmatter.

## Voice

Write like a person explaining something to a colleague. Second person,
plain words, short sentences mixed with longer ones. Technical
reference text stays neutral.

Do not use em dashes or en dashes in prose. A colon, comma, or period
does the job. Leave dashes inside code blocks, commands, paths, and
URLs alone.

Avoid AI tells: not-X-but-Y contrasts, one-line closers that restate
the section, staged openers ("let us dive in"), forced triads, inflated
claims ("pivotal", "seamless", "robust"), sales language, and bold
labels on list items. Headings use sentence case. One idea per
sentence. If a sentence adds nothing the reader lacks, cut it.

## Page anatomy

1. Frontmatter with `title` and a one-sentence `description`.
2. Lede of one or two sentences that sets up the mental model.
3. Task sections with verb headings ("Define a resource"). Each one:
   short prose, then a titled and complete code block, then follow-up
   prose on defaults, edge cases, and interactions.
4. A "Where adjacent concerns live" table where the topic forks.
5. A "What to read next" footer with relative links.

## Code blocks

Title every block with its file path:

```` ```ts title="snowflake/resources/databases.ts" ````

Blocks must be complete and copy-pasteable. No pseudo-code, no `...`
standing in for required fields. Every snippet traces to tested code:
copy from SDK tests or the reference adapter, then adapt as little as
possible. Anything the tests do not cover stays out.

## Contracts

Options and fields go in tables with four columns: name, type,
default, description. Signatures belong in
`reference/typescript-api.md` and in TSDoc. Guides link to them and
never duplicate them.

## Links

Relative links only (`./guides/stores`, `../concepts/mental-model`).
Omit the `.md` extension, Vercel style. Every page ends with "What to
read next". No orphans: link each new page from the README map and
from at least one related page.
