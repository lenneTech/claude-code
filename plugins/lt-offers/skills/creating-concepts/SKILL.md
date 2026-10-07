---
name: creating-concepts
description: 'Creates and edits concept folders (Konzeptmappen) on the Offers platform: protected, designed documents that hand the results of a workshop or concept phase to a customer, published under konzept.lenne.tech (demo: demo-konzept.lenne.tech). Turns workshop notes, transcripts and whiteboard photos into sources, proposes an outline, builds blocks and theme, links the folder to the offer it is based on, and prepares the sharing text. Keeps internal notes in sources, never in a visible or hidden block. Activates on "Konzeptmappe", "Workshop-Ergebnisse aufbereiten", konzept.lenne.tech, or /lt-offers:offers:concept. NOT for offers, quotations or pricing (use creating-offers).'
---

# Creating Concept Folders (Konzeptmappen)

A concept folder is the second document kind on the Offers platform (`kind: concept`). An offer asks the customer
to buy something; a concept folder hands over what was worked out together: the results of a workshop, a target
picture, a solution concept, the open decisions and the next step. It uses the same access code, content blocks and
themes as an offer and lives on its own domain.

It usually sits between two offers. It is based on the offer for the workshop or concept phase, and it often leads
to the offer for the implementation. The platform links these documents to each other (see "Linked offers").

## Gotchas

- **Internal notes belong in sources, never in a block, not even a hidden one.** Workshop material is full of things
  the customer must not read: assessments of participants, internal estimates and margins, the team's view of the
  customer's situation, ideas the group discarded. Store all of it with `add_offer_source` /
  `upload_offer_source_file`. Sources reach employees and `get_offer_context`, never the customer page or the PDF.
  A block with `visible: false` is the wrong place even though the public endpoint strips it: one toggle in the
  editor publishes it, every `duplicate_offer` and every template made from the folder carries it to the next
  customer, and every employee who edits the folder reads it as content. Before sharing, read every block once with
  the question "may the customer read this sentence?".
- **No prices, no offer PDF.** The API rejects a `pricing-table` block and an uploaded offer PDF (`offerPdfFileId`)
  on a concept folder. Effort and prices belong in the linked offer; the folder names the next step instead.
- **`validUntil` means „Zugang bis".** The content of a concept folder does not expire, the access to it does. The
  editor labels the field „Zugang bis", and once the date passes the customer page says „Der Zugang ist abgelaufen"
  (the public endpoints answer `410 Gone`). Set it when the access should end, for example with the end of the
  decision phase, or leave it empty.
- **The PDF prints the page, except what runs in the browser.** The platform prints the rendered customer page,
  always in light mode, with a table of contents that has page numbers and links; `rich-component` and `custom-html`
  look as they do online. A click dummy or an animation cannot run on paper.
- **Give every `html-embed` a `printHtml`.** It is static HTML that takes the element's place in the PDF and holds
  everything the demo can show: every step, every row, every case. The reader on paper then gets the same content,
  conveyed differently. Without it the block prints its `previewFileId` image — one image is one state, so for a
  simulator with eight steps or a matrix with 36 justifications nearly everything is missing; the image is the
  fallback, not the goal. Without either, a framed hint „<block title> — interaktiv, online abrufbar". The print
  version is sanitised and styled like a `custom-html` block, so tables, lists, headings and `<pre><code>` work, and
  online it is not rendered at all. Generate it from the diagram's own data rather than retyping it, or the two
  versions drift apart. `caption` is printed in every case and stays; `hint` is dropped once `printHtml` takes over,
  because it asks for interaction that paper cannot offer.
- A `lottie` block prints its `previewFileId`, which the first PDF fills with the animation's first frame when it is
  empty. Upload a preview image of your own when the motif matters.
- **Use the sharing text the platform renders.** `generate_snippet` returns the finished text in `snippet`, next to
  `link` (on the concept domain), `accessCode`, `title` and `kind`. The text comes from the template an admin
  maintains per document kind (Einstellungen → Anschreiben-Vorlagen) and is the same text the platform's own
  interface copies, so use it unchanged: a reworded version makes the two differ again. For a concept folder it reads
  „deine Konzeptmappe … ist bereit". If it calls the folder an „Angebot", the concept template is empty and the offer
  template filled in; tell the user to have an admin fill the concept template instead of rewording the text. The
  template also sets du or Sie. It may differ from the folder's own form of address on purpose: the sharing text and
  the platform's pages follow the organization's interface wording, the folder is the author's text. Leave it as it
  is. Never assemble the link by hand.
- **Sources need the document first.** `add_offer_source` takes the document id, so the folder is created as an empty
  draft before the workshop material is stored.
- **Photos and PDFs do not fit through a tool call.** `upload_offer_source_file` carries the file as base64 inside the
  tool call, which works for files of a few KB; a whiteboard photo or a scan is megabytes. Open such a file with
  `Read` (it shows images and PDFs), store a faithful transcription as a text source, and ask the user to attach the
  original in the platform editor under „Quellen & Unterlagen".
- **An offer does not turn into a concept folder.** `duplicate_offer` and `create_from_template` keep the kind, and
  switching `kind` to `concept` is rejected while a `pricing-table` block or an offer PDF is present. Create the
  folder as a new document and link the offer instead.
- **Two errors around a parameter, two causes.** Both arrive as `MCP error -32602`, and neither saves anything.
  „Unrecognized key: "relatedDocumentIds"" comes from the platform: it does not take that argument. Tell the user
  which argument was rejected instead of retrying without it, because a folder created without its link looks
  finished and is not. „expected array, received string at relatedDocumentIds" comes from this session: its tool
  list was loaded before the platform gained the parameter, so the list goes out as text. Ask the user to reconnect
  the server via `/mcp`, then repeat the call once; when the same error comes back, the tool list the platform
  serves lacks the parameter, so stop and tell the user. After every link change, read the folder back with `get_offer`:
  `relatedDocuments` must list the offer.
- **`update_offer` replaces the whole link list.** Sending `relatedDocumentIds` with only a new id removes every
  other link, on both sides. Read the current `relatedDocuments` with `get_offer` first and send the complete list;
  leave the field out when the links stay as they are.

## When to Use This Skill

- User wants to create, edit or optimize a Konzeptmappe / concept folder
- User has workshop material (notes, transcripts, whiteboard photos) to prepare for a customer
- User mentions konzept.lenne.tech or demo-konzept.lenne.tech
- User wants to link a concept folder and an offer

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Concept folder from workshop or concept-phase results | **THIS SKILL** |
| Offer, quotation, prices, Lexoffice PDF | `creating-offers` |
| Block schemas, themes, custom HTML, file uploads | `creating-offers` references (shared, see below) |

## Related Skills

**Works closely with:**
- `creating-offers` — the platform, the full MCP tool list, all block types and themes. This skill covers only what
  differs for concept folders and reads everything else from there.
- `/lt-offers:offers:concept` — the guided workflow built on this skill
- `/lt-offers:offers:optimize` — improves offers and concept folders alike
- `/lt-offers:offers:create` — the implementation offer that follows a concept folder

## MCP Connection

Concept folders run through the same two MCP servers as offers: `offers-api` (production, default) and
`offers-api-demo` (demo stage, only when the user mentions the demo). Routing rule, sign-in and the full tool list are
in `creating-offers` (`${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/SKILL.md`, section "MCP Connection"); the
`UserPromptSubmit` hook names the server for each prompt.

Every tool handles both kinds. What differs for concept folders:

| Tool | Concept-folder behaviour |
|---|---|
| `create_offer` | `kind: "concept"`; `relatedDocumentIds` links the offer it is based on, on both sides in one call |
| `create_offer` / `update_offer` | `subtitle` overrides the line under the title, which otherwise reads `<company> — <contact>`. A concept folder usually wants „für <Firma>" there, because it is handed to a team rather than to one addressee — see [offer-model.md](../creating-offers/reference/offer-model.md) |
| `update_offer` | `relatedDocumentIds` replaces the whole list (see Gotchas); switching `kind` follows the rules above |
| `list_offers` | `kind: "concept"` lists concept folders only |
| `get_offer` / `get_offer_context` | report `kind` and `relatedDocuments` (`id`, `kind`, `slug`, `status`, `title`) next to the raw `relatedDocumentIds` |
| `generate_snippet` | link on the concept domain; `snippet` holds the text from the concept template, used unchanged |
| `duplicate_offer` / `create_from_template` | keep the kind; the copy starts without links |

Company data comes from the account's knowledge base through `get_offer_context`, exactly as for offers. Where the
knowledge base lacks something the folder needs, ask the user. An organization can add its own conventions on top (a
skill from its internal plugin, or its CLAUDE.md); follow them where they name a source or a rule.

## Linked Offers

Documents carry `relatedDocumentIds`, and a link always holds in both directions: linking a folder to an offer links
the offer to the folder in the same call, so a second call adds nothing.

- Every id must name an existing document, otherwise the call fails with `400`; a repeated id counts once, and a link
  to the document itself is ignored. There is no limit on the number of links.
- `get_offer` and `get_offer_context` resolve the links into `relatedDocuments` (`id`, `kind`, `slug`, `status`,
  `title`). Rely on that list: it holds only documents that still exist, while the raw `relatedDocumentIds` can still
  name one deleted in the meantime.
- Copies start without links: `duplicate_offer` and templates take none along, because a copy that pointed at the
  original's folder would also appear on that folder. Restoring a backup as a new document drops the links too and
  says so in its `warnings`; restoring over the original keeps them.
- Links are an employee tool. The customer page and the PDF show neither the ids nor that a linked document exists.
  Whatever the customer should know about the related offer goes into a block, in words.

- **Creating a folder:** ask which offer it is based on (usually the offer for the workshop), find it with
  `list_offers` (`kind: "offer"`) and read it with `get_offer`. Take the customer data from it and keep its agreed
  goals and scope in view, then pass its id in `relatedDocumentIds` on `create_offer`.
- **An implementation offer follows:** `/lt-offers:offers:create` reads the folder and links it when it creates the
  offer; one call puts the link on both documents.
- **Optimizing either side:** read the linked documents first. A folder that promises a next step the linked offer
  does not cover, or an offer that ignores the folder's results, is the inconsistency worth reporting.

## Shared References

Read these from `creating-offers`; there are no copies here:

- `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/content-blocks.md` — all block types (`pricing-table` is
  offer-only), jump marks, upload tickets, file fields on update
- `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/custom-html-guide.md` — `custom-html` and `rich-component`,
  readability in both color modes
- `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/theming.md` — per-document theme and color mode
- `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/offer-model.md` — fields, status lifecycle, URL per kind
- `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/best-practices.md` — language and tone (no dashes, no
  emojis), verbatim customer quotes

Own reference:

- `${CLAUDE_SKILL_DIR}/reference/concept-structure.md` — from workshop material to a folder: sources, the
  internal-or-visible decision, outline proposal, design, examples

## Core Workflow

1. **Load context** — `get_offer_context` → company knowledge and global blocks
2. **Find the linked offer** — `list_offers` / `get_offer`; customer data and agreed scope
3. **Gather the frame** — title, customer, form of address (default **Sie**), „Zugang bis", and the line under the title (`subtitle`; „für <Firma>" is the usual choice for a folder)
4. **Create the draft** — `create_offer` with `kind: "concept"`, the customer data and `relatedDocumentIds`
5. **Store the workshop material as sources** — see `concept-structure.md` → "Material into sources"
6. **Reload the context** — `get_offer_context` with the folder id, now including sources and the linked offer
7. **Propose the outline** — as a list of sections with block types; build only after the user agrees
8. **Build blocks and theme** — `update_offer`
9. **Review internally** — `get_offer`; run the checklist below; open the link while signed in to the platform (an
   employee's visit does not count as a customer view and leaves the status untouched)
10. **Share** — `mark_sent` → `generate_snippet` → hand its `snippet` to the user unchanged (see Gotchas)

## Pre-Submission Checklist

- [ ] `get_offer` reports `kind: "concept"` and the linked offer, if there is one
- [ ] No internal note in any block, visible or hidden; internals live in sources
- [ ] No prices; the next step names the offer or the appointment instead
- [ ] Blocks ordered from 0 without gaps, meaningful titles, `showInToc` on the main sections
- [ ] `custom-html` readable in both color modes (`custom-html-guide.md`)
- [ ] Every `html-embed` has a `printHtml` carrying all its content, and a `caption`; a `previewFileId` only as a
  fallback where no print version exists
- [ ] Language rules from `best-practices.md`; form of address as agreed
- [ ] „Zugang bis" set, or left empty on purpose
- [ ] Sharing text is the `snippet` from `generate_snippet` and calls the document a Konzeptmappe; if it says
  „Angebot", the user knows the concept template needs filling
