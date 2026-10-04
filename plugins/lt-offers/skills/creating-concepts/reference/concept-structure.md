# From Workshop Material to a Concept Folder

How raw workshop material becomes a concept folder the customer can read: what goes into sources, what may reach a
block, how the outline is proposed, and how the folder is designed. Block schemas live in
`${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/content-blocks.md`.

## Material into sources

Everything the user brings in is stored as a source of the folder first, before a single block is written. Sources
are the folder's briefing: `get_offer_context` with the folder id returns them, so a later session (or
`/lt-offers:offers:optimize`) works from the same material instead of from a chat that is gone.

| Material | Tool | Note |
|---|---|---|
| Typed notes, minutes, a summary the user dictates | `add_offer_source`, `type: "text"` | One source per document or session, titled with topic and date |
| Transcript as a text file | `add_offer_source`, `type: "text"` with the file content | Split very long transcripts by session |
| Whiteboard photos, sketches, scans, PDFs | `Read` the file, then `add_offer_source`, `type: "text"` with a faithful transcription | Title it with topic, date and „(Transkription)"; ask the user to attach the original in the editor under „Quellen & Unterlagen" |
| A small file of a few KB | `upload_offer_source_file` (base64, real MIME type) | The file travels as base64 inside the tool call, so anything larger does not fit |
| Shared boards and documents (Miro, Google Docs …) | `add_offer_source`, `type: "link"` | The link only; the board's content is not fetched |

A source is internal by definition. A whiteboard photo stored as a source never reaches the customer. When the
customer should see the picture too, that is a separate decision: upload a curated copy with
`create_upload_ticket` (`purpose: "image"`) and an `image` block, after checking that it shows no sticky notes with
ratings, names or internal remarks. Often a clean diagram in `custom-html` serves the customer better than a photo of
the whiteboard.

## Internal or visible

Go through the material statement by statement and sort each one:

| Statement | Goes to |
|---|---|
| A result, decision or open question agreed with the customer | the folder |
| A discarded option whose rejection is part of the result („Variante B verworfen, weil …") | the folder |
| An assessment of people, the customer's team or the customer's situation | sources only |
| Internal estimates, budgets, margins, risks for the own company | sources only |
| Ideas the group dropped without a decision | sources only |
| Anything you cannot place | ask the user; never decide in favour of visibility |

Hidden blocks (`visible: false`) are not a third category; see the SKILL.md gotcha on internal notes.

## Outline as a proposal

A concept folder has no fixed structure. Derive the outline from the material, present it to the user as a list of
sections with the planned block type and a one-line content summary, and build only after the user agrees. Drop
sections the material has nothing for; merge sections that would stay thin.

A starting point for the proposal:

```
1. text            — Ausgangslage: who met, when, with which question
2. custom-html     — Auf einen Blick: the 3 to 5 core results, with jump marks to the sections below
3. text            — Ist-Situation and the challenges named in the workshop
4. custom-html /   — Zielbild or solution concept: diagrams, architecture, process,
   rich-component    cards per module
5. timeline        — Vorgehen: phases or roadmap
6. faq             — Offene Fragen, Annahmen, Entscheidungsbedarf
7. html-embed      — Klick-Dummy or prototype (with previewFileId and caption)
8. download        — Workshop documents the customer may keep (photo protocol, slides)
9. team            — Ansprechpartner
10. cta            — Nächster Schritt: an appointment, or the offer for the implementation
```

Shorter variants:

| Occasion | Sections |
|---|---|
| Result summary after a half-day workshop | 1, 2, 6, 10 |
| Solution concept after a concept phase | all, with 4 as the main part |
| Decision paper between options | 1, 2, 4 (one section per option), 6, 10 |

The `cta` never quotes a price. It names the next step; when an implementation offer exists or will follow, say so in
words. The offer has its own link and access code, so the folder does not link to it.

## Design

- **Individual pages:** `custom-html` for static layouts (comparison tables, process diagrams, cards),
  `rich-component` where NuxtUI components help (`UAccordion` for details, `UBadge` for status, `UCard` per module).
  Both must stay readable in light and dark mode: `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/custom-html-guide.md`.
- **Navigation:** a long folder gets an „Auf einen Blick" section whose items jump to the sections below
  (content-blocks.md → "Jump marks"). Write the links as same-page anchors (`href="#zielbild"`).
- **Theme:** the customer's palette via `theme`, and `colorMode` when the design is tuned for one appearance
  (`${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/theming.md`).
- **PDF:** the PDF prints the page, but a click dummy or an animation becomes a still image or a hint there
  (SKILL.md → "Gotchas"). Put the core results in blocks that read on paper, not only inside an `html-embed`.
- **Language:** German by default, form of address as agreed (default Sie), and the tone rules from
  `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/best-practices.md`: no dashes as punctuation, no emojis,
  customer quotes verbatim.

## Example prompts

```
Erstelle eine Konzeptmappe für die Musterfirma aus diesen Workshop-Notizen.
Grundlage ist das Workshop-Angebot „Digitalisierung der Auftragsabwicklung".
```

```
Hier sind die Fotos vom Whiteboard und das Transkript des Workshops mit dem
Beispielkunden. Leg die Konzeptmappe auf der Demo-Stage an, Zugang bis Ende November.
```

```
Optimiere die Konzeptmappe „Zielbild Kundenportal": die Zusammenfassung ist zu lang,
und die offenen Fragen fehlen.
```
