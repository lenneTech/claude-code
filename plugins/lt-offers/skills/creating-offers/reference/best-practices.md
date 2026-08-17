# Best Practices for Offer Content

## Language & Tone

- **Always German** — All offer content in German
- **Ansprache klären** — Ask the user: "Soll der Kunde geduzt oder gesiezt werden?" Default is **siezen** ("Sie/Ihr"). If the user chooses duzen, use "du/dein".
- **Avoid direct address** where possible — Focus on outcomes, not "you will get"
- **Professional but approachable** — Not too formal, not too casual
- **Action-oriented** — Use active verbs, clear CTAs
- **No dashes as punctuation** — Never use `—` (em dash) or `–` (en dash) to
  join clauses in offer content. German business writing separates with a
  comma, a colon, a semicolon, or a full stop. A dash-heavy text reads as
  machine-written, which is exactly the impression an offer must avoid. Rewrite
  instead of substituting: *"Er ist kein Produkt — Fehler sind zu erwarten"* →
  *"Er ist kein Produkt: Fehler sind zu erwarten"*, *"braucht keine Schulung —
  das ist die Bedingung"* → *"braucht keine Schulung. Genau das ist die
  Bedingung"*. Date and number ranges take "bis" (`Oktober bis November 2026`),
  not a dash.
- **No emojis** — Not in headings, not in lists, not in CTAs. They undercut the
  formality of a commercial document and render inconsistently in the PDF.
- Both rules apply to every field: block content, `title`, `description`,
  image `caption` and `alt`, FAQ questions and answers. Grep the payload for
  `—`, `–` and emoji before publishing.

## Customer quotes are verbatim, always

A `testimonial` quote or a `reference.quote` is a **statement by a real person
about a real project**. It is reproduced **word for word and in full**. There is
no editorial licence here, and this rule outranks every style rule above.

- **Never shorten.** Not the first sentence, not a middle sentence, not the one
  that seems off-topic. A quote trimmed to the "relevant" part changes what the
  person said and misrepresents them.
- **Never fix typos, punctuation or spelling**, even obvious ones. If the
  published original reads `progammiertechnische` or uses `an´s` with an acute
  accent, that is what goes into the offer. Flag it to the user instead so they
  can correct it at the source.
- **The dash and emoji rules do not apply inside quotes.** If the original
  contains `–`, it stays.
- **Attribution is part of the quote.** Name, company and job title come from
  the same source. Do not invent or "improve" a role (`Projektinitiatorin`
  instead of the actual `Firmenkundenbetreuerin / Gründung und Nachfolge` is a
  factual error, not a wording choice).
- **Reusing a quote from another offer is not a source.** It may already have
  been shortened there. Always go back to the canonical source.

### Canonical source and verification

The authoritative wording lives at **https://lenne.tech/kundenerfolge**.

**The page shows only 3 of 15 quotes on load.** The rest sit behind a "Mehr
anzeigen" button that has to be clicked repeatedly (it reappears after each
click until the list is exhausted). Anyone reading the page visually, or via a
summarizing fetch, silently sees a fraction of the testimonials and will
conclude a quote "does not exist" when it does.

The button only reveals what is already there: **the Nuxt payload in the raw
HTML contains all entries from the first request** (verified — 15 of 15 quotes
present without a single click). So pull the raw HTML and work on that; it is
both complete and exact. Never read this page through a summarizing fetch — that
paraphrases the very text that must stay verbatim.

```bash
curl -sL https://lenne.tech/kundenerfolge -o /tmp/ke.html
```

```python
import re, html
raw = open('/tmp/ke.html', encoding='utf-8').read()
txt = raw.replace('\\u002F', '/').replace('\\"', '"').replace('\\n', ' ')  # JSON escapes
txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(txt)))
quote = "…exactly the string you put into the offer…"
print('verbatim' if re.sub(r'\s+', ' ', quote).strip() in txt else 'ALTERED')
```

Run this for every quote before publishing. `ALTERED` means fix the offer, not
the check.

## Reusable Blocks (lenne.tech Developers Only)

> **Guard:** This section only applies if git is installed and `git config user.email` contains `@lenne.tech`. Otherwise skip without mention.

When creating content, consider whether a block should be a **global reusable block** instead of inline content:

| Reusable (→ global block) | Not reusable (→ inline) |
|---------------------------|------------------------|
| Company introduction | Customer-specific greeting |
| Standard team section | Project-specific timeline |
| Recurring FAQ items | Custom pricing |
| Legal disclaimers / AGB | Tailored CTA |
| "Unser Prozess" / methodology | Customer testimonial |

If a block qualifies as reusable, suggest creating it in the offers repository so it can be referenced via `global-ref` in future offers. See SKILL.md "Reusable Global Blocks" for the full workflow.

## Recommended Block Structure

### Standard Offer

```
1. text       — Greeting / Introduction
2. text       — Project summary / Understanding of needs
3. timeline   — Project phases with milestones
4. text       — Approach / Methodology
5. team       — Team members involved
6. pricing    — Pricing table
7. reference  — Similar project showcase
8. testimonial — Customer quote
9. faq        — Common questions
10. cta       — Next steps / Contact
```

### Quick Quote

```
1. text       — Brief introduction
2. pricing    — Pricing table
3. cta        — Contact button
```

### Detailed Proposal

```
1. text       — Executive summary
2. text       — Problem analysis
3. text       — Proposed solution
4. timeline   — Implementation phases
5. team       — Key personnel
6. reference  — 2-3 relevant references
7. pricing    — Detailed pricing
8. faq        — Terms & conditions
9. download   — Attachments (contracts, specs)
10. cta       — Sign-off / Contact
```

## Content Quality Guidelines

### Text Blocks
- Keep paragraphs short (3-4 sentences max)
- Use headings to structure longer texts
- Highlight key benefits in bold
- Include concrete numbers where possible

### Pricing Tables
- Use clear, descriptive titles for each item
- Include brief descriptions explaining what's included
- Be specific about units (pauschal, pro Stunde, pro Monat)
- Group related items logically

### FAQs
- 3-5 questions are ideal
- Address common concerns proactively
- Keep answers concise but complete
- Include payment terms, timeline, support info

### Testimonials
- Include company name for credibility
- Keep quotes concise (1-2 sentences)
- Choose quotes relevant to the offer topic

### CTAs
- One clear action per CTA block
- Use action verbs: "Jetzt anfragen", "Termin vereinbaren", "Angebot annehmen"
- Place at the end, optionally also after pricing

## Example Prompts for Claude Code

```
Erstelle ein Angebot fuer die Firma TechStart GmbH fuer eine
Website-Entwicklung. Budget ca. 15.000 EUR, Zeitraum 3 Monate.
Fuege Preistabelle, Timeline, Team und FAQ hinzu.
```

```
Optimiere das Angebot "Cloud Migration" — die Texte sind zu lang
und es fehlt ein Testimonial. Kuerze die Texte und fuege ein
passendes Kundenzitat hinzu.
```

```
Erstelle aus der Vorlage "Standard-Webprojekt" ein neues Angebot
fuer die Firma "Digital Solutions AG", Ansprechpartner Max Mueller.
Passe die Preise an: Design 8.000 EUR, Entwicklung 12.000 EUR.
```
