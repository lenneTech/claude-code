# Best Practices for Offer Content

## Language & Tone

- **German by default** — All offer content in German, unless the user or the knowledge base asks for another language
- **Clarify the form of address** — Ask the user: "Soll der Kunde geduzt oder gesiezt werden?" Default is **siezen** ("Sie/Ihr"). If the user chooses duzen, use "du/dein".
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

The authoritative wording is wherever the company publishes its customer
testimonials. Find it in this order:

1. **The organization's own conventions** — a skill from its internal plugin
   or its CLAUDE.md naming the references page.
2. **The knowledge base** — an entry in category `portfolio` that holds the
   quotes or links to the page publishing them (`get_offer_context`,
   `list_knowledge`).
3. **The user** — when neither names a source, ask for it, and offer to store
   its link as a `portfolio` entry so later offers find it.

A quote whose published original cannot be found is not used.

**Read a references page as raw HTML, never through a summarizing fetch.** A
summarizing fetch paraphrases the very text that must stay verbatim. Many
references pages also show only a few quotes on load and reveal the rest behind
a "Mehr anzeigen" / "show more" button; anyone reading the page visually sees a
fraction of the testimonials and concludes a quote "does not exist" when it
does. On pages built with Nuxt, Next or similar frameworks the embedded payload
in the raw HTML usually carries every entry from the first request, so pull the
raw HTML and work on that:

```bash
curl -sL "<references page URL>" -o /tmp/references.html
```

```python
import re, html
raw = open('/tmp/references.html', encoding='utf-8').read()
txt = raw.replace('\\u002F', '/').replace('\\"', '"').replace('\\n', ' ')  # JSON escapes
txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(txt)))
quote = "…exactly the string you put into the offer…"
print('verbatim' if re.sub(r'\s+', ' ', quote).strip() in txt else 'ALTERED')
```

Run this for every quote before publishing. `ALTERED` means fix the offer, not
the check.

## Reusable Content

When creating content, decide whether a block is reusable or belongs to this
offer alone:

| Reusable (→ knowledge base or template) | Not reusable (→ inline) |
|---------------------------|------------------------|
| Company introduction | Customer-specific greeting |
| Standard team section | Project-specific timeline |
| Recurring FAQ items | Custom pricing |
| Legal disclaimers / AGB | Tailored CTA |
| "Unser Prozess" / methodology | Customer testimonial |

If a block qualifies as reusable, suggest storing it as a knowledge base entry
or a template offer. See SKILL.md "Reusing Content Across Offers" for which fits
when.

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
- Prefer quotes that are already short at the source (1-2 sentences); a longer quote goes in whole, never trimmed (see "Customer quotes are verbatim, always")
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
