---
name: rod-humanizer
description: >-
  Rod Humanizer. Humanize marketing and product copy in a warm, casual,
  professional voice; cut em-dash overuse, hyperbole, and clichés (thought
  leader, best in class, world class, mid-market leader, and similar). Also
  audit LLM/agent system prompts so they do not instruct or encourage that
  language in generated output. Use when the user asks for the Rod Humanizer,
  a humanizer, a humanizer pass, the Rod skill, a Rod pass, de-AI copy,
  prompt voice audit, or to make writing (or prompts) sound like a person
  wrote it.
---

# Rod Humanizer

Rewrite visitor-facing copy so it sounds like a careful human wrote it:
**warm and casual, but professional.** Do not sound like a brochure, a pitch
deck, or a default LLM.

**Also audit agent prompts** (system prompts, task instructions, identity
blocks, DB-backed prompt templates) so models are not *taught* to produce that
language.

Default mode is **suggest first**: report findings and proposed rewrites.
Apply edits only when the user asks you to implement.

## Voice

- Talk like a smart colleague explaining something over coffee, then cleaned up
  for a public site.
- Prefer short sentences. Contractions forms are fine (`you're`, `don't`, `that's`).
- Be specific. Name the work, the constraint, or the outcome.
- Keep brand and legal facts accurate. Never invent capabilities.

## Cut these

### Em dashes
- Reduce overuse. Prefer a comma, a colon, a period, or a second sentence.
- Keep rare intentional pauses. Leave empty-state placeholders that are only
  `—`, and leave brand wordmarks that already use an em dash if the design
  system requires them.
- Soft target: at most one spaced ` — ` per short paragraph; none is better.

### Hyperbole
Strip or rewrite claims that inflate without evidence, including:
unparalleled, unprecedented, world-class, best-in-class, industry-leading,
cutting-edge, state-of-the-art, revolutionary, transformative (as fluff),
game-changing, seamless, robust (as filler), comprehensive (as filler),
mission-critical (unless the customer said it), end-to-end (as filler).

### Cliché / consultant phrases
Never leave these in customer-facing copy (case-insensitive; hyphen variants
count):

- thought leader / thought leadership
- best in class / best-in-class
- world class / world-class
- mid-market leader / mid market leaders
- industry leading / industry-leading
- trusted partner (as empty praise)
- peace of mind
- one-stop shop
- synergy / synergies
- paradigm shift
- holistic
- leverage (as buzzword)
- circle back
- low-hanging fruit
- move the needle
- value-add
- delve
- in today's [anything]
- it's important to note / it's worth noting
- furthermore / moreover as throat-clearing

Also cut AI-default glue when it adds no meaning: "landscape" as a crutch,
"ecosystem" for ordinary partner lists, "unlock" for ordinary access,
"empower", "elevate", "harness", "foster", "utilize", "navigate … with
clarity and confidence" stacks.

Project identity docs (for example `pulseone-identity.md`) and existing
banned-phrase tests outrank this list when they are stricter. Merge both.

## AI tells to rewrite

| Tell | Prefer |
|------|--------|
| Uniform punchy cadence every sentence | Mix short and medium sentences |
| No contractions | Natural contractions |
| Em-dash chains and "not X, but Y" on loop | Plain contrast; vary structure |
| Abstract nouns stacked ("clarity, confidence, and operational depth") | One concrete claim |
| Fake intimacy ("we're passionate about…") | What you actually do |
| Stacked hedges then a big claim | One honest sentence |

## Agent prompt audit (required on full Rod Humanizer passes)

Prompts shape every generated page, email, and card. A clean public site with
sloppy prompts will re-pollute itself. On any **full** Rod pass (site + agents,
or when the user mentions prompts / agents / LLM instructions / a humanizer pass), include this
audit.

### Surfaces to scan
- Identity / voice docs loaded into system prompts (e.g. `pulseone-identity.md`)
- Hardcoded system / task instruction strings in services (`*_SYSTEM`,
  `*_INSTRUCTIONS`, `build_*_system_prompt`, advisor composers)
- Domain / classify / summarize / newsletter / recommended-path prompt builders
- DB-backed prompt templates or Prompt Lab content if the project has them
- Image or caption prompts only when they produce customer-visible text

Skip: test fixtures that quote banned phrases on purpose; comments that only
document what to avoid (still verify the *instructional* half is clear).

### What to flag in prompts

1. **Instructed bad voice** — the prompt tells the model to be punchy,
   compelling, inspiring, prestigious, thought-leading, best-in-class, or to
   use em dashes / brochure cadence.
2. **Missing guardrails** — customer-facing generator prompts that never say
   to avoid clichés, hyperbole, or heavy em dashes (identity block may cover
   this; say so if it does).
3. **Role costume** — “trusted C-level advisor” / “world-class consultant”
   framing that pulls the model into prestige language.
4. **Em-dash modeling** — instructional prose full of `—` teaches the model
   that is normal output punctuation (schema/rule lines can stay tighter than
   prose examples).
5. **Contradiction** — identity says avoid X, task prompt asks for X
   (“punchy”, “executive tone” without defining plain language).

### Prompt-specific prefer

| Avoid in prompts | Prefer |
|------------------|--------|
| punchy / compelling / impactful headline | clear, specific, present-tense; one concrete claim |
| executive tone (undefined) | plainspoken; warm; professional; short sentences; contractions OK |
| trusted C-level advisor (prestige) | PulseOne advisor / write for busy operators and executives |
| heavy em dashes in instruction prose | commas, colons, periods; explicitly limit em dashes in **output** |
| robust rewrite (optimizer meta-prompt fluff) | stricter, clearer, edge-case complete |

When suggesting prompt edits, show the instruction snippet and a replacement
that keeps schema/JSON rules intact.

## Workflow

```
- [ ] 1. Scope surfaces (pages, components, content libs, llms.txt, identity)
- [ ] 2. Scope agent prompts (system/task strings, identity, prompt templates)
- [ ] 3. Scan both for em dashes, banned phrases, hyperbole, AI tells,
         and prompted-bad-voice instructions
- [ ] 4. Report findings with file paths (site vs prompts, separately)
- [ ] 5. Suggest before/after rewrites (do not edit yet)
- [ ] 6. If asked to apply: edit site and/or prompts, keep facts/schemas,
         run voice/copy tests
```

### Suggest mode (default)
For each issue, show:

1. **Where** — file and brief locator (mark **prompt** vs **site**)  
2. **Why** — which Rod Humanizer rule it breaks  
3. **Suggested** — replacement copy or instruction  

Group by surface. End with a short priority list (do first / nice later).

### Apply mode (only when asked)
- Edit the smallest set of files that clears the findings.
- Do not "improve" unrelated sections.
- Preserve meaning, offers, JSON schemas, and legal/scope boundaries.
- After prompt edits, clear any in-process prompt caches the project documents
  (or note that a process restart is required).
- Re-run project voice/banned-phrase tests when they exist.
- Summarize what changed.

## Out of scope
- Admin UI chrome, logs, code comments, test fixtures that intentionally quote banned phrases
- Changing product strategy or inventing proof points
- Making copy bland by deleting every strong word; specificity is not hyperbole
- Weakening security/jailbreak instructions inside prompts

## Reference
- Expanded phrase list and rewrite examples: [phrases.md](phrases.md)
