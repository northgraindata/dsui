# Docs writing guide

This file applies to everything under `apps/docs`. It adapts the [Vercel writing guidelines](https://github.com/vercel-labs/writing-guidelines) to DSUI. Run the checks in [`REVIEW.md`](REVIEW.md) before you open a pull request that changes a page.

## Plan before you write

Every page starts with a short plan. Put the plan in the pull request description.

1. **Overview**: what the page covers, in one sentence.
2. **Goal**: what the reader can do afterwards, using a testable verb such as `configure`, `explain`, or `debug`.
3. **Audience**: who reads the page (see audiences below).
4. **Content type**: set `contentType` in the frontmatter.
5. **Open questions**: facts you still have to verify in code.

One page does one job. If a page needs two content types, split it.

### Content types

- **Tutorial**: a guided path to a first result. Warm, predictable, no traps.
- **How-to**: one task for a reader who is mid-task. Terse and direct.
- **Reference**: neutral, exhaustive, easy to quote.
- **Conceptual**: explains a model so the reader can teach it back. Examples and analogies are welcome.
- **Troubleshooting**: acknowledge the error, then give the fix. Empathetic, not apologetic.
- **Landing**: orients the reader and links onward.

### Audiences

- **Operator**: runs DSUI and connects services.
- **Adapter author**: builds an adapter with the Adapter SDK.
- **Plugin author**: builds a plugin with the Plugin SDK.
- **Contributor**: changes DSUI itself. This audience reads `CONTRIBUTING.md`, not the docs site.

## Verify every claim in code

The docs describe the code as it is today. Do not copy a claim from another page or from memory. Open the source, confirm the behavior, and note the file in the pull request. When the code and an older page disagree, the code wins. Do not change product code to make a page true. List the mismatch in the pull request description instead.

## Voice

- Use active voice. If "by monkeys" fits after the verb, rewrite the sentence.
- Address the reader as "you". Never write "the user" or "one can".
- Use imperatives for steps: "Click **Add service**", not "You will need to click".
- Keep sentences under 20 words.
- Use contractions.
- Use the present tense unless you describe future behavior.
- Limit "we" to deliberate project decisions, such as "we recommend".
- Do not use `easy`, `simple`, `quick`, `very`, `just`, `really`, `simply`, or `obviously`.
- Do not ask rhetorical questions.
- Each sentence must parse on one read. Name the subject, the action, and the consequence.

## Concision

- Cut any detail that would not change what the reader understands or does.
- Replace weasel words (`significantly`, `many`, `often`, `typically`) with a specific claim.
- Replace vague quantifiers (`near-zero`, `most requests`) with a figure you verified.
- Replace metaphor verbs (`lands`, `carries`, `hits`, `moves through`) with the literal step.

## Avoid AI tells

- No summary transitions that recap the previous paragraph, such as "With this setup complete…".
- No stop-start fragments that split one idea into choppy sentences.
- No spec-sheet voice: `provides`, `is configurable`, `leverages`.
- No cold-open paragraphs that lack an antecedent.
- No artifacts that act like people. Write "the browser fetches the URL", not "hand the browser a URL".
- No template framing that fits any page.

## Structure

- Start every page with a one-paragraph summary. The `description` frontmatter field is that summary, and the page renders it under the title.
- Open every major section with a sentence that says what it covers.
- Keep paragraphs to 2 to 4 sentences.
- Use sentence case for every heading: "Configure environment variables".
- Use descriptive headings. "Caveats when using the DSUI Agent" beats "Caveats".
- The `title` frontmatter becomes the H1. Never add an H1 in the body.
- Use Title Case only for the sidebar label (`navLabel`), when it differs from the title.
- Spell out acronyms on first use.
- Define a term on first use and link it to its concept page.
- Do not use `---` rules between sections. Use headings.

## Lists

- Turn three or more list-shaped items into a list.
- Use bullets for unordered items and numbers for ordered steps.
- Introduce a list with a colon.
- Do not end an item with a period unless it is a full sentence.
- Format definitions as `- **Term**: description`.

## Code

- Give every code block a language tag.
- Write TypeScript first for new code, unless the surface is language-agnostic.
- Wrap multi-step procedures in `<Steps>`.
- Highlight the load-bearing lines with a range, for example ` ```ts {3-5} `.
- Keep snippets under 25 lines and under 80 columns. Split longer ones with prose.
- Explain what each block does. Never "drop and run".
- Keep code comments minimal. Explain in prose between blocks.
- Put all code inline. Do not write "see the full example file".
- Every `dsui.yaml` snippet must be complete. A reader who copies it must get a working workspace, including the `adapters:` block and the connection `method:`.

## Placeholders, units, and numbers

- Write text placeholders in descriptive `snake_case`: `your_master_key`, so readers can double-click to select them.
- Count number placeholders upward: `1234567890123`.
- Never write `<TOKEN>`, `xxx`, `your-token`, or `ABC123`.
- Put a space between a number and its unit, and use uppercase data units: `64 KB`, `200 ms`. Seconds stay bare: `30s`.
- Use numerals for counts: "8 services", not "eight".

## Typography

- Never use an em dash. Use a colon, a comma, a period, or rephrase. The same goes for a hyphen used as punctuation.
- Use the ellipsis character `…`, and end loading states with it: `Loading…`.
- Use `&` for "and" only in tight UI labels.
- Do not hard-wrap paragraphs. Each paragraph is one source line.
- Leave one blank line before headings and around code blocks. Add no other blank lines.

## Emphasis and links

- Use bold for UI elements and critical facts only. If you reach for bold for tone, rewrite the sentence.
- Use inline code for paths, extensions, identifiers, commands, and short snippets. If it looks wrong without monospace, monospace it.
- Anchor text names the destination. Never use "here", "link", or a bare URL.
- Link to internal pages with absolute paths that start with `/docs/`.

## DSUI vocabulary

Use these terms exactly. Mixing them is the most common source of confusion.

- **Workspace**: the DSUI app a person opens in the browser.
- **Service**: one configured connection to a data tool, declared in `dsui.yaml` or added in the workspace.
- **Adapter**: code that teaches DSUI to talk to one kind of service. One adapter process runs per service.
- **Plugin**: trusted code that extends the whole installation: pages, jobs, signals, settings.
- **DSUI Agent**: the process that tunnels requests to services inside a private network. It appears under **Settings → Agents**.
- **AI assistant**: the chat feature provided by the AI plugin. Never call it "DSUI Agent".
- **DSUI Cloud**: the managed hosting offer.

## Components

- Use `<Steps>` for procedures, `<Callout>` for notes and warnings, `<Tabs>` for equivalent alternatives, and `<Cards>` for landing links.
- Use a `<Callout type="warning">` instead of a blockquote for the Developer Preview notice.
- Show adapter coverage with `<Badge>` rather than prose.

## Review

- The author is accountable for accuracy, however the text was produced.
- Disclose AI use in the pull request description.
- Link the page plan and the preview in the description, and list the code files you verified against.
- Test the page: can a model complete the page's goal from that page alone?
