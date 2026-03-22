# Best Practices for Offer Content

## Language & Tone

- **Always German** — All offer content in German
- **Ansprache klären** — Ask the user: "Soll der Kunde geduzt oder gesiezt werden?" Default is **siezen** ("Sie/Ihr"). If the user chooses duzen, use "du/dein".
- **Avoid direct address** where possible — Focus on outcomes, not "you will get"
- **Professional but approachable** — Not too formal, not too casual
- **Action-oriented** — Use active verbs, clear CTAs

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
