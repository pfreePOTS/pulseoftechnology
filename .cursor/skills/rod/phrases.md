# Rod skill — phrases and rewrites

## Always rewrite (customer-facing)

| Avoid | Prefer |
|-------|--------|
| thought leader / thought leadership | say what they actually know or do |
| best in class / best-in-class | drop, or name the concrete standard |
| world class / world-class | drop, or name the proof |
| mid-market leader(s) | small and mid-market organizations / business leaders |
| industry-leading | drop, or cite the specific practice |
| trusted partner | we work with you / we stay on the engagement |
| peace of mind | say what risk is reduced |
| one-stop shop | list the services |
| cutting-edge / state-of-the-art | name the technology |
| seamless(ly) | without extra handoffs / without a second login |
| robust / comprehensive (filler) | name the controls or scope |
| unlock [value/potential] | get / use / start |
| empower | help / give [role] the ability to |
| navigate with clarity and confidence | help you decide / show you where you stand |
| technology landscape (as habit) | what is changing / what we are watching |
| partner ecosystem (empty) | the platforms we work with |
| delve into | look at / dig into (sparingly) |
| in today's environment | drop the opener; start with the point |
| it's important to note that | delete; keep the clause |
| furthermore / moreover | and / also / or start a new sentence |

## Em dashes

| Avoid | Prefer |
|-------|--------|
| Claim — restatement — third beat | Two sentences, or one with a comma |
| Sorry — we couldn't… | Sorry, we couldn't… |
| Good news — we have you covered | Good news: we have you covered |
| West region — Los Angeles | West region: Los Angeles |

Keep: lone `—` as empty UI placeholder; designed brand locks that already include an em dash.

## Hyperbole vs specificity

| Hyperbole | Specific |
|-----------|----------|
| technology is only as powerful as the relationships… | service starts with people who answer and stay accountable |
| unparalleled expertise | twenty years delivering this work |
| transformative journey | the rollout / the first ninety days |
| mission-critical continuity | systems that cannot go down without stopping operations |

## Before / after examples

**Before:** We are a trusted mid-market leader delivering best-in-class, world-class managed services.

**After:** We manage business technology for small and mid-market organizations, and we stay on the work after the roadmap is written.

**Before:** Unlock clarity and confidence as you navigate today's technology landscape.

**After:** We will tell you what is changing in your industry, where you stand, and what to do next.

**Before:** Our passionate team empowers you with seamless, end-to-end solutions.

**After:** The same people who advise you also do the implementation, so the plan matches what your team can absorb.

## Prompt instruction examples

**Before (task prompt):**
`{"headline": "<string, max 120 characters, punchy and present-tense>"}`

**After:**
`{"headline": "<string, max 120 characters, clear and present-tense; one concrete claim, no hype>"}`

**Before:**
`You are a trusted C-level technology advisor writing concise executive briefings.`

**After:**
`You write short briefings for busy executives and operators. Be plainspoken, specific, and warm. No clichés, no hype, no stacked em dashes.`

**Before (instruction prose):**
`Respond with valid JSON only — no markdown — and keep an authoritative executive tone.`

**After:**
`Respond with valid JSON only (no markdown). Use plain language a non-specialist executive will finish reading.`

**Add when missing** (if identity is not already injected):
`Obey the project identity/voice rules. Avoid consultant clichés, hyperbole, and heavy em dashes in all customer-visible fields.`

