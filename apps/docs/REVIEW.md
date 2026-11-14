# Docs review prompt

Use this prompt to review documentation pages against the writing guide. It adapts the review command from the [Vercel writing guidelines](https://github.com/vercel-labs/writing-guidelines).

## How to run it

1. Run `bun run --filter @northgraindata/dsui-docs lint` first. It catches the mechanical rules.
2. Give the prompt below to an agent, with the pages to review as the target.
3. Fix every finding, or reject it with a one-line reason in the pull request.

## Prompt

Review the target documentation pages in `apps/docs/content/docs` for compliance with `apps/docs/AGENTS.md`. Read each file in full before you report. Report only real problems.

Check these areas:

1. **Plan and type**: the page does one job, declares a `contentType`, and has a testable goal. Flag pages that mix content types.
2. **Accuracy**: for each factual claim about behavior, find the source file in the repository and confirm it. Flag claims you cannot verify. Flag code samples that would not run, and `dsui.yaml` snippets that are incomplete.
3. **Voice**: passive voice, "the user", sentences over 20 words, rhetorical questions, banned words, weasel words, vague quantifiers, metaphor verbs.
4. **AI tells**: recap transitions, stop-start fragments, spec-sheet voice, cold-open paragraphs, personified artifacts, template framing.
5. **Structure**: a description that works as a TL;DR, sentence-case descriptive headings, an opening sentence in each major section, paragraphs of 2 to 4 sentences, terms defined on first use, acronyms spelled out.
6. **Lists and code**: list-shaped prose that should be a list, missing colons, code without a language tag, snippets over 25 lines, comments that belong in prose, "see the full example".
7. **Vocabulary**: DSUI Agent versus AI assistant, service versus adapter, workspace. Flag any mix-up.
8. **Typography and format**: em dashes, hard-wrapped paragraphs, extra blank lines, `---` rules, bold used for tone.
9. **Links**: anchor text that doesn't name the destination, bare URLs, links to pages or anchors that don't exist.
10. **Completeness**: limits and prerequisites are stated, tutorials list prerequisites, and the simplest path is recommended when several exist.

## Output format

Group findings by file. Write one finding per line as `file:line - issue`, using terse notes. End a file with no findings with `✓ pass`.

```text
content/docs/guides/private-networks.mdx:31 - banned word "easy"
content/docs/guides/private-networks.mdx:44 - unverified claim: "adapters need no changes" (only the ClickHouse and PostgreSQL adapters read the proxy variables)
content/docs/getting-started/docker.mdx ✓ pass
```
