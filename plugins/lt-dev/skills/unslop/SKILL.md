---
name: unslop
description: 'Cuts AI tells from any text that reaches a human reader: Linear tickets and comments, commit messages, MR/PR descriptions, READMEs and migration guides, QA test instructions, offer and showcase copy, code comments, and the body of skills, commands, and agents. Carries the English pattern catalogue, a German one (Nominalstil, Floskeln, Füllwörter, Gedankenstrich), and the rules for putting voice back in. Activates whenever prose is written or edited for a human, and on "unslop", "entschwurbeln", "klingt nach KI", "KI-Sprech", "slop". NOT for code identifiers, generated files, or quoted third-party text.'
---

# Unslop

Edit text to remove AI patterns and add human voice.

## When this skill activates

Any time text is written for a human reader, not for a parser. In lt projects that means:

- Linear tickets, ticket comments, and review handoffs
- Commit messages (body), MR/PR descriptions, changelog entries
- READMEs, migration guides, ADRs, inline code comments
- QA test instructions and manual re-test handoffs
- Customer-facing copy: offers (`lt-offers`), showcases (`lt-showroom`), release notes
- The body of skills, commands, and agents in this plugin
- Chat answers to the user

Also activates on request: "unslop", "entschwurbeln", "das klingt nach KI", "mach das menschlicher".

## Where this does not apply

Do not rewrite these. Cutting a pattern here breaks something or misrepresents someone.

- Code identifiers, API field names, generated files (`types.gen.ts`, `sdk.gen.ts`), schema descriptions that a consumer parses
- Conventional-Commit subject lines, semantic-release footers, CI output, log lines. These are machine-read and stay terse. "Add soul" is for prose, never for a commit subject.
- Quoted upstream text: release notes from a dependency, an error message, a customer email, an excerpt from a third-party doc. Quote it as it stands.
- Customer documents in their original language. Translating or restyling them changes the record.

## Process

1. Scan for the patterns below.
2. Rewrite. Preserve meaning, match intended tone.
3. Add soul (see next section).
4. Self-audit: "What makes this obviously AI generated?" Fix remaining tells.

## Adding soul

Removing patterns is half the job. Sterile, voiceless writing is just as obvious.

- **Have opinions.** React to facts instead of neutrally listing pros and cons.
- **Vary rhythm.** Short sentences. Then longer ones that take their time. Mix it up.
- **Acknowledge complexity.** "Impressive but also kind of unsettling" beats "impressive."
- **Use "I" when it fits.** First person isn't unprofessional.
- **Let some mess in.** Perfect structure looks machine-made.
- **Be specific.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am."

## Patterns to detect and fix

### Content

1. **Puffery.** "pivotal moment", "testament to", "evolving landscape", "setting the stage for", "indelible mark", "deeply rooted". Cut puffery, state what happened.
2. **Name-dropping.** Listing media outlets without context. Pick one, say what was said.
3. **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete or expand with real sources.
4. **Promotional language.** "nestled", "vibrant", "breathtaking", "groundbreaking", "renowned", "stunning", "must-visit". Use neutral descriptions.
5. **Vague attributions.** "Experts believe", "Industry reports suggest", "Some critics argue". Name the source or delete.
6. **Formulaic challenges.** "Despite challenges... continues to thrive." Replace with specific facts.

### Language

7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
8. **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Just say "is" or "has".
9. **"Not just X, but Y."** State the point directly instead.
10. **Rule of three.** Forcing ideas into groups of three. Use the natural number.
11. **Synonym cycling.** Protagonist, main character, central figure, hero all in one paragraph. Pick one, repeat it.
12. **False ranges.** "from X to Y" where X and Y aren't on a meaningful scale. List topics directly.

### Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or commas only (no parentheses, no en dashes, no hyphen-as-dash substitutes). Em dashes are an AI tell, and reaching for parentheses instead just trades one tell for another. If a thought needs separation, end the sentence or use a comma.
14. **Colon overuse.** Colons are fine before a list or example. Not as mid-sentence connectors. "If you're coming from traditional automation: instead of registering event handlers, you describe conditions" adds nothing with the colon. Rewrite to let the point stand on its own without comparison framing. "Describing when the scheduler should fire works best as plain English." Same meaning, no crutch punctuation.
15. **Boldface overuse.** Don't bold every proper noun or acronym.
16. **Inline-header lists.** The tell is a bold label and colon that restates the line: "**Performance:** Performance improved...". Convert those to prose. A bold lead-in that ends in a period, names the item, and is followed by genuinely new detail ("**Schema in TypeScript.** Tables live in one file.") is fine, not a tell.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove from headings and bullets.
19. **Curly quotes.** Replace with straight quotes. German prose is the exception, see pattern 38.

### Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!" Remove.
21. **Cutoff disclaimers.** "While specific details are limited..." Find sources or remove.
22. **Sycophantic tone.** "Great question! You're absolutely right!" Respond directly.

### Filler

23. **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted.
24. **Excessive hedging.** "could potentially possibly be argued that it might" becomes "may".
25. **Generic conclusions.** "The future looks bright." State specific plans or facts.

### Jargon

26. **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as noun), harness (as metaphor), surface (as in "API surface"), bedrock, scaffolding (as metaphor), modality, paradigm, gold-plating, ratchet (as metaphor), evacuate (for moving code), endgame, north star, flywheel. These read as technical but usually have a plainer concrete word. "Substrate" becomes "base". "Wedge in" becomes "add". "Vector" becomes "way" or "method". "Gold-plating" becomes "more than the job needs". "Ratchet" becomes the mechanism's real name or "a limit that only tightens". "Evacuate" becomes "move out". "Endgame" becomes "the last phase". Pick the concrete word.

### Plain speech

27. **Say what it does, not how it feels.** "the database stays close at hand", "SQL you can read", "types that follow your schema" name a feeling. The fix names the mechanism or a number: "`.toSQL()` returns the exact string sent to the database", "a column rename fails the build". Ask what the sentence tells the reader to do or know, then write that. If you can't restate it as a concrete instruction, fact, or number, cut it. One more check: if the sentence could appear unchanged in another project's docs, it says nothing about this one. Cut it.
28. **Shorten or split dense sentences.** If the reader has to backtrack to parse a sentence, break it in two or drop clauses. One idea per sentence.
29. **Active voice.** Prefer it. Catch "is/are/was/were + past participle" and name the actor: "queries are validated" becomes "the compiler validates queries", "the file is parsed by the loader" becomes "the loader parses the file". Passive is fine only when the actor is unknown or genuinely doesn't matter.
30. **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is fast" or the number. "significantly improves" becomes the measured delta. An adverb propping up a weak verb means the verb is wrong.
31. **Prefer the plain word.** "utilize" becomes "use", "leverage" becomes "use", "facilitate" becomes "help", "numerous" becomes "many", "in the event that" becomes "if". The fancier synonym is rarely clearer.

### German text

Patterns 1 to 31 apply to German too. These are the tells that only show up there. Linear tickets, customer copy, and chat answers to the user are usually German, so this section carries most of the weight in daily work.

32. **Nominalstil.** The strongest German AI tell. A verb turned into an "-ung" noun, then propped up by erfolgen, durchführen, vornehmen, gewährleisten, ermöglichen, darstellen. "Die Durchführung der Prüfung erfolgt automatisch" becomes "Die Prüfung läuft automatisch". "Eine Anpassung der Konfiguration ist erforderlich" becomes "Die Konfiguration muss angepasst werden", better "Passe die Konfiguration an". Find the verb hiding in the noun and use it.
33. **Floskeln.** "In der heutigen schnelllebigen Zeit", "spielt eine entscheidende Rolle", "ist nicht mehr wegzudenken", "ein wichtiger Meilenstein", "wegweisend", "ganzheitlich", "maßgeblich", "revolutionär", "State of the Art". Say what happened instead.
34. **Füllwörter und Streckformen.** "Es ist wichtig zu beachten, dass" gets deleted. "Aufgrund der Tatsache, dass" becomes "Weil". "Im Rahmen von" becomes "Bei". "Zum jetzigen Zeitpunkt" becomes "Jetzt". "In der Lage sein zu" becomes "können". "Eine Vielzahl von" becomes "viele". "Diesbezüglich", "dahingehend", "seitens" get cut or replaced.
35. **Aufzählungs-Konnektoren.** "Darüber hinaus", "Des Weiteren", "Zudem", "Ferner" at the start of every second sentence. Cut most of them. If the order is clear from the content, no connector is needed.
36. **Zusammenfassungs-Reflex.** "Zusammenfassend lässt sich sagen", "Insgesamt zeigt sich", "Abschließend bleibt festzuhalten", "Die Zukunft bleibt spannend". Cut. A German summary paragraph that repeats the text above adds nothing.
37. **Höflichkeitsfloskeln.** "Gerne!", "Sehr gute Frage!", "Ich hoffe, das hilft!", "Selbstverständlich!", "Kein Problem!". Answer directly.
38. **Typografie.** Straight quotes are right in code, commit messages, and identifiers. In German prose „so“ is correct orthography and stays. The em dash "—" is not German punctuation at all: correct German uses a spaced en dash "–", but overusing it is the same tell as pattern 13, so prefer a period or comma. Never strip umlauts or ß to write "fuer" or "loeschen".

## Self-audit before shipping

Run these three checks on the finished text:

1. Grep your own output for the worst offenders. `Additionally`, `crucial`, `showcase`, `underscore`, `—`, `Zusammenfassend`, `Es ist wichtig`, `Darüber hinaus`.
2. Read the first sentence of every paragraph in a row. If they all have the same shape, vary them.
3. Ask whether any sentence would survive unchanged in a different project's docs. If yes, it says nothing. Cut it.

## Related skills

- `writing-qa-test-instructions` skill. Applies these rules to manual re-test handoffs.
- `developing-claude-plugins` skill. Skill, command, and agent bodies are prose and go through this skill before release.
- `lt-offers:creating-offers` and `lt-showroom:creating-showcases` skills. Customer-facing copy, where German patterns 32 to 38 matter most.
- `/lt-dev:git:commit-message` and `/lt-dev:git:mr-description` commands. The body is prose, the subject line stays terse.

## Attribution

Adapted from the `unslop` skill in the `pstack` plugin by Lauren Tan, MIT licensed.
Source: <https://github.com/cursor/plugins/tree/main/pstack/skills/unslop>
The upstream licence text is kept next to this file in `LICENSE`.
Patterns 1 to 31 are upstream. The lt sections, the German set, and the self-audit are additions.
