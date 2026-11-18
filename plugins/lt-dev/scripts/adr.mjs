#!/usr/bin/env node
// adr.mjs — deterministic helper for a repository's Architecture Decision Records (ADRs).
//
// The maintaining-architecture-decisions skill decides what goes into an ADR and when a change
// conflicts with one; this script does the parts that must not depend on judgement: finding the
// log, listing every decision in one compact line for screening, taking the next free number
// across all branches, writing the skeleton, marking a superseded ADR, keeping the index table
// current, and linting the log (numbering, status, links, index, secrets) before it is committed.
//
// It reads the formats in use rather than imposing one: the lt default (`# ADR-NNN: <decision>`
// plus a `**Date:** · **Status:** · **Topic:**` line, English or German field names, umlauts or
// their ASCII forms), MADR/YAML frontmatter (`status:`, `date:`), and adr-tools (`## Status`
// section, `Date:` line).
//
// Usage:
//   node adr.mjs find                                   the ADR logs of this repository
//   node adr.mjs list [--active] [--json]               one line per ADR, for screening
//   node adr.mjs next                                   next free number (work tree + all branches)
//   node adr.mjs lang [--json]                          the language the project writes (log, then docs)
//   node adr.mjs init [--lang en|de]                    create the log and its README (idempotent)
//   node adr.mjs new --title "<decision>" [--topic <t>] [--status accepted|proposed]
//                    [--supersedes <n,…>] [--partially-supersedes <n,…>] [--origin "<text>"]
//                    [--date YYYY-MM-DD] [--lang en|de]
//   node adr.mjs index [--write]                        regenerate the table between the markers
//   node adr.mjs check [--json]                         lint the log; exit 1 on errors
// Common options: --root <dir> (default: git top level of the cwd; writes need it inside that repository),
// --log <dir> (one log only; for lang/init/new/next the log to write, default the root log or docs/adr, never a
// subproject's log).
// init and new write in the project's language (`lang`); when it is unclear they stop with exit 3 until
// --lang names the language the developer chose. They write only into a log inside the repository,
// never into .claude/ or .git/.
// Exit codes: 0 ok, 1 check found errors, 2 usage error or nothing to act on, 3 language unclear.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LOG_DIR_NAMES = [
  'docs/adr',
  'docs/adrs',
  'docs/decisions',
  'docs/architecture/decisions',
  'docs/entscheidungen',
  'doc/adr',
  'doc/decisions',
  'adr',
  'decisions',
];
export const DEFAULT_LOG = 'docs/adr';
export const INDEX_START = '<!-- adr-index:start -->';
export const INDEX_END = '<!-- adr-index:end -->';
export const TEMPLATE_MARK = 'adr-template:';
const SUBPROJECT_PARENTS = ['projects', 'packages', 'apps'];
const ADR_FILE = /^(?:adr[-_]?)?(\d{1,5})[-_](.+)\.md$/i;

// ---------------------------------------------------------------------------------------------
// Parsing

const FIELD_ALIASES = {
  status: ['status'],
  date: ['date', 'datum'],
  topic: ['topic', 'thema', 'area', 'bereich', 'tags'],
  supersedes: ['supersedes', 'ersetzt', 'replaces', 'loest ab', 'löst ab'],
  origin: ['origin', 'herkunft', 'source', 'quelle'],
};

function fieldKey(name) {
  const n = name.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) if (aliases.includes(n)) return key;
  return undefined;
}

/** Folds German umlauts to their ASCII forms, so `gültig` and `gueltig` read alike. */
export function fold(text) {
  return text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

const STATUS_WORDS = [
  ['superseded', /(superseded|ueberholt|abgeloest|replaced|ersetzt durch)/],
  ['deprecated', /(deprecated|veraltet|aufgehoben|retired|obsolete)/],
  ['rejected', /(rejected|verworfen|abgelehnt|declined)/],
  ['proposed', /(proposed|vorgeschlagen|draft|entwurf|pending)/],
  // Implementation states (built, im Betrieb …) belong to a decision that was taken, so they bind like accepted.
  ['accepted', /(accepted|gueltig|valid|active|angenommen|beschlossen|in kraft|decided|entschieden|implemented|in place|in progress|built|rolled out|trial|pilot|gebaut|umgesetzt|in umsetzung|im bau|im betrieb|aufgenommen|eingefuehrt|im versuch|in erprobung)/],
];

/**
 * Classifies a free-text status into one of: accepted, partially-superseded, superseded,
 * proposed, rejected, deprecated, unknown. Accepted and partially-superseded bind a change;
 * proposed is noted but does not bind. The first status word decides, because real statuses
 * carry qualifiers ("gültig; teilweise Ablösung vorgeschlagen in ADR-082" is still accepted),
 * and a decision that is both superseded and still valid somewhere is partially superseded.
 */
export function classifyStatus(raw) {
  if (!raw) return 'unknown';
  // Link targets are file names, and a slug such as `...-gueltigkeit.md` must not read as a status word.
  const s = fold(raw.replace(/\]\([^)]*\)/g, ']'));
  const hits = STATUS_WORDS
    .map(([category, re]) => [category, re.exec(s)?.index])
    .filter(([, index]) => index !== undefined)
    .sort((a, b) => a[1] - b[1]);
  if (!hits.length) return 'unknown';
  const first = hits[0][0];
  const has = (category) => hits.some(([c]) => c === category);
  const partial = /(partial|teilweise)/.test(s);
  if (first === 'superseded' || first === 'deprecated') return has('accepted') || partial ? 'partially-superseded' : first;
  if (first === 'accepted') return has('superseded') || has('deprecated') ? 'partially-superseded' : 'accepted';
  return first;
}

export const BINDING = new Set(['accepted', 'partially-superseded']);
export const INACTIVE = new Set(['superseded', 'rejected', 'deprecated']);

/** ADR numbers a status or supersedes text refers to (links, `ADR-12`, `durch 061`, `by 61`). */
export function referencedNumbers(text) {
  if (!text) return [];
  const found = new Set();
  const patterns = [
    /ADR[-\s]?0*(\d{1,5})\b/gi,
    /\[0*(\d{1,5})\]\(/g,
    /\(\.?\/?(?:[^)\s]*\/)?0*(\d{1,5})-[^)\s]+\.md\)/g,
    /(?:durch|by)\s+0*(\d{1,5})\b/gi,
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
}

/**
 * References into the same log only. A link that leaves the log's folder (`../../projects/api/
 * docs/adr/007-x.md`, an inherited starter log) names another log's number and is not checked here.
 */
export function localReferences(text) {
  return referencedNumbers((text ?? '').replace(/\[[^\]]*\]\([^)]*\.\.\/[^)]*\)/g, ''));
}

function cleanTitle(heading) {
  return heading
    .replace(/^(?:ADR|Decision|Entscheidung)[\s-]*0*\d+\s*[:.\-–—]\s*/i, '')
    .replace(/^0*\d+\.\s+/, '')
    .trim();
}

/** Parses one ADR file's text. `file` is the base name, used for the number. */
export function parseAdr(text, file) {
  const m = ADR_FILE.exec(file);
  const adr = {
    file,
    number: m ? Number(m[1]) : undefined,
    title: '',
    statusRaw: '',
    status: 'unknown',
    date: '',
    topic: '',
    supersedes: [],
    supersededBy: [],
    origin: '',
    titleLine: 0,
    statusLine: 0,
  };
  const lines = text.split(/\r?\n/);
  const fields = {};
  const fieldLines = {};
  let start = 0;

  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      for (let i = 1; i < end; i++) {
        const kv = /^([A-Za-z_-]+)\s*:\s*(.*)$/.exec(lines[i]);
        if (!kv) continue;
        const key = fieldKey(kv[1].replace(/[_-]by$/, '')) ?? (/(superseded[_-]by)/i.test(kv[1]) ? 'supersededByField' : undefined);
        const value = kv[2].replace(/^["']|["']$/g, '').trim();
        if (key && !fields[key]) {
          fields[key] = value;
          fieldLines[key] = i + 1;
        }
        if (/^title$/i.test(kv[1]) && !adr.title) {
          adr.title = value;
          adr.titleLine = i + 1;
        }
      }
      start = end + 1;
    }
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!adr.title) {
      const h = /^#\s+(.+?)\s*$/.exec(line);
      if (h) {
        adr.title = cleanTitle(h[1]);
        adr.titleLine = i + 1;
        continue;
      }
    }
    // **Field:** value · **Field:** value — one or several per line.
    for (const fm of line.matchAll(/\*\*([^*]+?):\*\*\s*(.*?)(?=\s*·\s*\*\*[^*]+?:\*\*|\s*$)/g)) {
      const key = fieldKey(fm[1]);
      if (key && !fields[key]) {
        fields[key] = fm[2].trim();
        fieldLines[key] = i + 1;
      }
    }
    // adr-tools: "Date: 2020-01-01" and "Status: Accepted" lines near the top.
    const plain = /^(Date|Datum|Status):\s+(.+)$/i.exec(line);
    if (plain) {
      const key = fieldKey(plain[1]);
      if (key && !fields[key]) {
        fields[key] = plain[2].trim();
        fieldLines[key] = i + 1;
      }
    }
    // adr-tools / MADR: "## Status" section, first non-empty line.
    if (/^##\s+Status\s*$/i.test(line) && !fields.status) {
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#/.test(lines[j])) break;
        if (lines[j].trim()) {
          fields.status = lines[j].trim();
          fieldLines.status = j + 1;
          break;
        }
      }
    }
  }

  adr.statusRaw = fields.status ?? '';
  adr.status = classifyStatus(adr.statusRaw);
  adr.statusLine = fieldLines.status ?? 0;
  adr.date = (/(\d{4}-\d{2}-\d{2})/.exec(fields.date ?? '') ?? [])[1] ?? '';
  adr.topic = (fields.topic ?? '').replace(/[[\]]/g, '').trim();
  adr.origin = fields.origin ?? '';
  adr.supersedes = localReferences(fields.supersedes ?? '');
  adr.supersededBy = INACTIVE.has(adr.status) || adr.status === 'partially-superseded'
    ? localReferences(`${adr.statusRaw} ${fields.supersededByField ?? ''}`).filter((n) => n !== adr.number)
    : [];
  return adr;
}

// ---------------------------------------------------------------------------------------------
// Repository and logs

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

export function repoRoot(cwd) {
  const top = git(cwd, ['rev-parse', '--show-toplevel']).trim();
  return top || cwd;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readText(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

export function adrFiles(dir) {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .filter((f) => ADR_FILE.test(f) && !/^readme/i.test(f))
    .sort((a, b) => Number(ADR_FILE.exec(a)[1]) - Number(ADR_FILE.exec(b)[1]) || a.localeCompare(b));
}

function looksLikeLog(dir) {
  if (adrFiles(dir).length > 0) return true;
  const readme = readText(join(dir, 'README.md'));
  return readme.includes(INDEX_START) || /architecture decision|\bADRs?\b/i.test(readme);
}

/** Every ADR log in the repository: root logs first, then those of subprojects. Paths are relative. */
export function findLogs(root) {
  const bases = ['.'];
  for (const parent of SUBPROJECT_PARENTS) {
    const p = join(root, parent);
    if (!isDir(p)) continue;
    for (const child of readdirSync(p).sort()) {
      if (child.startsWith('.') || child === 'node_modules') continue;
      if (isDir(join(p, child))) bases.push(`${parent}/${child}`);
    }
  }
  const logs = [];
  for (const base of bases) {
    for (const name of LOG_DIR_NAMES) {
      const rel = base === '.' ? name : `${base}/${name}`;
      if (looksLikeLog(join(root, rel))) logs.push(rel);
    }
  }
  return logs;
}

export function loadLog(root, rel) {
  const dir = join(root, rel);
  const adrs = adrFiles(dir).map((f) => {
    const text = readText(join(dir, f));
    return { ...parseAdr(text, f), text };
  });
  return { log: rel, dir, adrs, width: numberWidth(adrs.map((a) => a.file)) };
}

function numberWidth(files) {
  let width = 3;
  for (const f of files) {
    const m = ADR_FILE.exec(f);
    if (m && m[1].length > width) width = m[1].length;
  }
  return width;
}

export function pad(n, width = 3) {
  return String(n).padStart(width, '0');
}

export function adrId(n, width = 3) {
  return `ADR-${pad(n, width)}`;
}

/** Numbers already taken in the log on any local or remote branch, so parallel branches do not collide. */
export function numbersOnBranches(root, rel) {
  const refs = git(root, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'])
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r && !r.endsWith('/HEAD'))
    .slice(0, 300);
  const taken = new Set();
  for (const ref of refs) {
    const out = git(root, ['ls-tree', '--name-only', ref, '--', `${rel}/`]);
    for (const line of out.split('\n')) {
      const m = ADR_FILE.exec(basename(line.trim()));
      if (m) taken.add(Number(m[1]));
    }
  }
  return taken;
}

export function nextNumber(root, rel) {
  const local = adrFiles(join(root, rel)).map((f) => Number(ADR_FILE.exec(f)[1]));
  const all = [...local, ...numbersOnBranches(root, rel)];
  return (all.length ? Math.max(...all) : 0) + 1;
}

// ---------------------------------------------------------------------------------------------
// Language and templates

const GERMAN_WORDS = /\b(und|der|die|das|nicht|ist|wird|mit|für|fuer|eine?n?|auf|Entscheidung|Datum|Kontext)\b/gi;
const ENGLISH_WORDS = /\b(the|and|is|not|with|for|an?|on|decision|context|which|that)\b/gi;
export const LANGUAGES = ['en', 'de'];
const DOC_FILES = ['README.md', 'CLAUDE.md', 'AGENTS.md', 'CONTRIBUTING.md'];
const MIN_WORDS = 15;

/** Prose only: code blocks, inline code and comments carry identifiers, not the document's language. */
function prose(text) {
  return text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
}

export function languageCounts(text) {
  const p = prose(text ?? '');
  return { de: (p.match(GERMAN_WORDS) ?? []).length, en: (p.match(ENGLISH_WORDS) ?? []).length };
}

/**
 * `de` or `en` when one language clearly dominates (twice the other's marker words), `mixed` when a
 * text has enough prose but no dominant language, `short` when it has too little prose to tell.
 */
export function classifyLanguage(text) {
  const { de, en } = languageCounts(text);
  if (de + en < MIN_WORDS) return { lang: 'short', de, en };
  if (de >= 2 * en) return { lang: 'de', de, en };
  if (en >= 2 * de) return { lang: 'en', de, en };
  return { lang: 'mixed', de, en };
}

/** Binary guess for a text already known to be one language (the index table's header). */
export function detectLanguage(text) {
  const { de, en } = languageCounts(text);
  return de > en ? 'de' : 'en';
}

/**
 * The language the project already writes, so a new ADR does not switch it. The log decides when it
 * holds prose; otherwise the project's documentation (README.md, CLAUDE.md, AGENTS.md,
 * CONTRIBUTING.md, docs/*.md) decides when every source with enough prose names the same language.
 * A mixed source, two sources that disagree, or no source with enough prose make it `unclear`, and
 * the developer is asked instead of guessed for.
 */
export function projectLanguage(root, rel) {
  const logDir = join(root, rel);
  const logText = [join(logDir, 'README.md'), ...adrFiles(logDir).slice(0, 5).map((f) => join(logDir, f))].map(readText).join('\n');
  const logClass = classifyLanguage(logText);
  if (logClass.lang !== 'short') {
    return { lang: LANGUAGES.includes(logClass.lang) ? logClass.lang : 'unclear', decidedBy: 'log', sources: [{ source: rel, ...logClass }] };
  }
  const files = [...DOC_FILES];
  const docsDir = join(root, 'docs');
  if (isDir(docsDir)) {
    files.push(...readdirSync(docsDir).filter((n) => /\.md$/i.test(n)).sort().slice(0, 10).map((n) => `docs/${n}`));
  }
  const sources = [];
  for (const f of files) {
    const text = readText(join(root, f));
    if (text.trim()) sources.push({ source: f, ...classifyLanguage(text) });
  }
  const telling = sources.filter((s) => s.lang !== 'short');
  const langs = [...new Set(telling.map((s) => s.lang))];
  const lang = langs.length === 1 && LANGUAGES.includes(langs[0]) ? langs[0] : 'unclear';
  return { lang, decidedBy: 'docs', sources };
}

function describeSources(sources) {
  return sources.map((s) => `${s.source}: ${s.lang} (de ${s.de}, en ${s.en})`).join('; ') || 'no documentation found';
}

/**
 * The language to write in: `--lang` when given and consistent with the log, else the detected one.
 * Returns { lang } or { code, message } when the run must stop.
 */
export function resolveLanguage(root, rel, requested) {
  const detected = projectLanguage(root, rel);
  if (requested !== undefined && requested !== true) {
    if (!LANGUAGES.includes(requested)) {
      return { code: 2, message: `templates exist for ${LANGUAGES.join(' and ')}; write an ADR in "${requested}" by hand, in the format of the existing log` };
    }
    if (detected.decidedBy === 'log' && LANGUAGES.includes(detected.lang) && detected.lang !== requested) {
      return { code: 2, message: `${rel} is written in ${detected.lang}; an ADR in ${requested} would mix the log's languages` };
    }
    return { lang: requested };
  }
  if (detected.lang === 'unclear') {
    return {
      code: 3,
      message: `language unclear (${describeSources(detected.sources)}): ask the developer which language the ADRs are written in, then pass --lang ${LANGUAGES.join('|')}`,
    };
  }
  return { lang: detected.lang };
}

/** True when the log writes German status words in ASCII (`gueltig`, `ueberholt`), as some logs do. */
function asciiGerman(logDir) {
  const text = adrFiles(logDir).slice(0, 10).map((f) => readText(join(logDir, f))).join('\n');
  return /\b(gueltig|ueberholt)\b/.test(text) && !/\b(gültig|überholt)\b/.test(text);
}

const WORDS = {
  en: {
    date: 'Date', status: 'Status', topic: 'Topic', supersedes: 'Supersedes', origin: 'Origin', partially: 'partially',
    accepted: 'accepted', proposed: 'proposed', supersededBy: 'superseded by', partiallySupersededBy: 'partially superseded by',
    sections: [
      ['Context', 'What was open, what was on the table, and what triggered the decision.'],
      ['Decision', 'What holds, concretely: the rule a later change could break, with the code, config or contract that fixes it.'],
      ['Rationale', 'The reasons actually given (quoted from commit, ticket, MR or docs) and the numbers behind them. A reason that is only inferred is marked [inferred].'],
      ['Rejected alternatives', 'Each alternative that was considered: what it was and why not. A later proposal that revives one of them is a conflict with this ADR.'],
      ['Consequences', 'What follows from it, including the price and what a change now has to respect.'],
      ['Evidence', 'Commits (hash and title), path:line, ticket or MR IDs, measurements, verbatim quotes. No ADR without evidence.'],
    ],
    readmeTitle: 'Architecture Decision Records',
    tableHead: '| No | Date | Decision | Status |\n|---|---|---|---|',
  },
  de: {
    date: 'Datum', status: 'Status', topic: 'Thema', supersedes: 'Ersetzt', origin: 'Herkunft', partially: 'teilweise',
    accepted: 'gültig', proposed: 'vorgeschlagen', supersededBy: 'überholt durch', partiallySupersededBy: 'teilweise überholt durch',
    sections: [
      ['Kontext', 'Was war offen, was stand zur Wahl, was war der Auslöser.'],
      ['Entscheidung', 'Was gilt, konkret: die Regel, die eine spätere Änderung brechen könnte, mit dem Code, der Konfiguration oder dem Vertrag, der sie festschreibt.'],
      ['Begründung', 'Die Gründe, die tatsächlich gegeben wurden (Zitat aus Commit, Ticket, MR oder Doku), und die Zahlen dahinter. Ein nur vermuteter Grund ist als [vermutet] markiert.'],
      ['Verworfene Alternativen', 'Je Alternative: was und weshalb nicht. Ein späterer Vorschlag, der eine davon wieder aufgreift, ist ein Konflikt mit diesem ADR.'],
      ['Konsequenzen', 'Was daraus folgt, auch der Preis, und was eine Änderung jetzt beachten muss.'],
      ['Belege', 'Commits (Hash und Titel), Datei:Zeile, Ticket- oder MR-IDs, Messwerte, wörtliche Zitate. Kein ADR ohne Beleg.'],
    ],
    readmeTitle: 'Architekturentscheidungen (ADRs)',
    tableHead: '| Nr | Datum | Entscheidung | Status |\n|---|---|---|---|',
  },
};

function asciiFold(text) {
  return text.replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/Ü/g, 'Ue').replace(/Ö/g, 'Oe').replace(/Ä/g, 'Ae');
}

export function slugify(title) {
  const ascii = title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length <= 60) return ascii || 'decision';
  const cut = ascii.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : 60);
}

export function readmeTemplate(lang) {
  if (lang === 'de') {
    return `# ${WORDS.de.readmeTitle}

Ein **ADR** (*Architecture Decision Record*) hält eine Entscheidung fest: was offen war, was gewählt
wurde und vor allem **warum**, mit Beleg. Code zeigt, was gebaut wurde, aber nie, warum es nicht
anders gebaut wurde. Genau das geht sonst verloren, und genau das verhindert, dass eine spätere
Änderung eine Entscheidung aus Versehen rückgängig macht.

- **Kein ADR ohne Beleg.** Jede Behauptung trägt eine Fundstelle: Commit, \`Datei:Zeile\`, Ticket,
  Messwert oder wörtliches Zitat. Ein nur vermuteter Grund steht als \`[vermutet]\` da.
- **Ein ADR wird abgelöst, nie gelöscht oder umgeschrieben.** Ändert sich eine Entscheidung, entsteht
  ein neuer ADR mit \`**Ersetzt:**\`; der alte behält seinen Text, nur sein Status wird
  \`überholt durch ADR-NNN\`.

**Vor einer Änderung an Architektur, Abhängigkeiten, Datenmodell, API-Verträgen, Rechten oder
Infrastruktur** die Tabelle unten lesen. Eine Änderung, die einem gültigen ADR widerspricht, braucht
einen ausdrücklichen Auftrag dazu oder die ausdrückliche Zustimmung des Entwicklers, und dann einen
neuen ADR, der den alten ablöst.

Dieses Log wird mit dem Code versioniert: keine Secrets, Zugangsdaten oder personenbezogenen Daten.

## Einen ADR anlegen

1. Nächste freie Nummer nehmen, auch offene Branches beachten; Dateiname \`NNN-kurzer-slug.md\`
   (Kleinbuchstaben, Bindestriche, keine Umlaute). Mit dem lt-dev-Plugin für Claude Code erledigt
   \`/lt-dev:adr\` das.
2. Kopf: \`# ADR-NNN: Ein Satz, der die Entscheidung nennt\`, darunter
   \`**Datum:** JJJJ-MM-TT · **Status:** gültig · **Thema:** <Thema>\`, bei Ablösung zusätzlich
   \`**Ersetzt:** [ADR-NNN](NNN-slug.md)\`.
3. Abschnitte: Kontext, Entscheidung, Begründung, Verworfene Alternativen, Konsequenzen, Belege.
4. Die Tabelle unten ergänzen.

**Kein ADR** ist ein Bugfix ohne Wahl, eine Messung ohne Folge, ein Zwischenstand oder ein Feature,
das einer bestehenden Entscheidung folgt.

## Alle ADRs

${INDEX_START}
${WORDS.de.tableHead}
${INDEX_END}
`;
  }
  return `# ${WORDS.en.readmeTitle}

An **ADR** (*Architecture Decision Record*) records one decision: what was open, what was chosen
and above all **why**, with evidence. Code shows what was built, never why it was not built
differently. That is the part that gets lost, and the part that keeps a later change from undoing
a decision by accident.

- **No ADR without evidence.** Every claim carries a source: a commit, \`path:line\`, a ticket, a
  measurement or a verbatim quote. A reason that is only inferred is marked \`[inferred]\`.
- **An ADR is superseded, never deleted or rewritten.** A changed decision gets a new ADR with
  \`**Supersedes:**\`; the old one keeps its text, and only its status becomes
  \`superseded by ADR-NNN\`.

**Before changing architecture, dependencies, the data model, API contracts, permissions or
infrastructure**, read the table below. A change that contradicts an accepted ADR needs an explicit
order to change it or the developer's explicit approval, and then a new ADR that supersedes the old
one.

This log is versioned with the code: no secrets, credentials or personal data.

## Adding an ADR

1. Take the next free number, open branches included; file name \`NNN-short-slug.md\` (lowercase,
   hyphens, ASCII). With the lt-dev plugin for Claude Code, \`/lt-dev:adr\` does this.
2. Header: \`# ADR-NNN: One sentence that states the decision\`, below it
   \`**Date:** YYYY-MM-DD · **Status:** accepted · **Topic:** <topic>\`, plus
   \`**Supersedes:** [ADR-NNN](NNN-slug.md)\` when it replaces one.
3. Sections: Context, Decision, Rationale, Rejected alternatives, Consequences, Evidence.
4. Add it to the table below.

**Not an ADR:** a bug fix without a choice, a measurement without consequence, an intermediate
state, or a feature that follows an existing decision.

## All ADRs

${INDEX_START}
${WORDS.en.tableHead}
${INDEX_END}
`;
}

export function adrTemplate({ number, width = 3, title, date, status, topic, supersedes = [], partial = [], origin, lang, files = {} }) {
  const w = WORDS[lang] ?? WORDS.en;
  const link = (n) => (files[n] ? `[${adrId(n, width)}](${files[n]})` : adrId(n, width));
  const head = [`**${w.date}:** ${date}`, `**${w.status}:** ${status}`];
  if (topic) head.push(`**${w.topic}:** ${topic}`);
  const lines = [`# ${adrId(number, width)}: ${title}`, '', head.join(' · ')];
  const replaced = [...supersedes.map(link), ...partial.map((n) => `${link(n)} (${w.partially})`)];
  if (replaced.length) lines.push(`**${w.supersedes}:** ${replaced.join(', ')}`);
  if (origin) lines.push(`**${w.origin}:** ${origin}`);
  for (const [heading, hint] of w.sections) lines.push('', `## ${heading}`, '', `<!-- ${TEMPLATE_MARK} ${hint} -->`);
  return `${lines.join('\n')}\n`;
}

/** Rewrites the status value of a superseded ADR. Returns the new text, or undefined when no status line was found. */
export function markSuperseded(text, statusValue) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/\*\*Status:\*\*/.test(lines[i])) {
      lines[i] = lines[i].replace(/(\*\*Status:\*\*\s*)(.*?)(?=\s*·\s*\*\*[^*]+?:\*\*|\s*$)/, `$1${statusValue}`);
      return lines.join('\n');
    }
    if (i < 30 && /^status\s*:/i.test(lines[i]) && lines[0].trim() === '---') {
      lines[i] = `status: ${statusValue.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')}`;
      return lines.join('\n');
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Index

function cell(text) {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function renderIndex(adrs, width, lang) {
  const w = WORDS[lang] ?? WORDS.en;
  const rows = adrs.map((a) => `| [${pad(a.number, width)}](${a.file}) | ${a.date} | ${cell(a.title)} | ${cell(a.statusRaw || '?')} |`);
  return [w.tableHead, ...rows].join('\n');
}

export function replaceIndex(readme, table) {
  const s = readme.indexOf(INDEX_START);
  const e = readme.indexOf(INDEX_END);
  if (s < 0 || e < s) return undefined;
  return `${readme.slice(0, s + INDEX_START.length)}\n${table}\n${readme.slice(e)}`;
}

// ---------------------------------------------------------------------------------------------
// Secrets and personal data

const PLACEHOLDER = /^(?:<[^>]*>|\$\{?[A-Z_][A-Z0-9_]*\}?|\*+|x+|\.{3}|…|password|passwort|pass|pw|secret|geheim|changeme|example|beispiel|your[-_a-z]*|my[-_a-z]*|dummy|test|redacted)$/i;

export const SECRET_RULES = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Linear API key', /\blin_api_[A-Za-z0-9]{20,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{30,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['Brevo API key', /\bxkeysib-[A-Za-z0-9-]{20,}/],
  ['API key', /\b(?:sk-ant-|sk-live-|sk_live_|sk_test_|rk_live_|sk-proj-)[A-Za-z0-9_-]{16,}|\bsk-[A-Za-z0-9]{32,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
];

// A key that names a secret, also inside an identifier (`DB_PASSWORD`, `NSC__JWT__SECRET`, `accessToken`), followed
// by `:` or `=`, with markdown bold or quotes around either side (`**Password:** x`, `"token": "x"`).
const SECRET_KEY = '[A-Za-z0-9_.-]*?(?:password|passwd|passwort|pwd|pass|secret|token|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|access[_-]?key)';
const SECRET_ASSIGNMENT = new RegExp(`(?<![A-Za-z0-9])${SECRET_KEY}["'*]*\\s*[:=]\\s*\\**\\s*["'\`]?([^\\s"'\`,;)|*]+)`, 'gi');
// The same as a table row whose first cell is the key: `| password | x |`. A key in a later column is a name
// in a wider table, not a key-value pair.
const SECRET_TABLE_ROW = new RegExp(`^\\s*\\|\\s*[*\`]*${SECRET_KEY}[*\`]*\\s*\\|\\s*[*\`]*([^\\s|\`*]+)`, 'gi');

/**
 * True for a value that names where a secret comes from, or is code, rather than being one. A value of
 * letters only (an identifier such as CoreRedisService) is not reported either: telling it from a
 * passphrase would flag every class name, so the scan stays a net and the rule in the skill stays the rule.
 */
function notASecretValue(value) {
  return (
    PLACEHOLDER.test(value) ||
    /^(?:true|false|null|undefined|none|required|optional|string|number|boolean)$/i.test(value) ||
    /^[A-Za-z]+$/.test(value) || // an identifier or a word
    /^[A-Z][A-Z0-9_]*$/.test(value) || // a variable name such as NSC__BETTER_AUTH__SECRET
    /[([?…]|\.\.\.|=>|:$/.test(value) || // code (a call, an index, optional chaining), an elision or a label
    /^(?:process\.env|import\.meta|config|env|this|settings)\b|^[$({<@]|^https?:|^\.{0,2}\//i.test(value) ||
    /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)+$/.test(value) || // a reference such as var.registry_password
    /^[a-z]+(?:[-_][a-z]+)+$/.test(value) || // a resource name such as grafana-oauth
    /^[A-Za-z_-]+(?:\/[A-Za-z_.-]+)+$/.test(value) // a route or path such as application/statistics
  );
}

/** Findings in one text: [{ line, rule, kind }]. Placeholders such as `<password>` or `${DB_PASS}` pass. */
export function scanSecrets(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const [rule, re] of SECRET_RULES) if (re.test(line)) findings.push({ line: idx + 1, rule, kind: 'error' });
    for (const m of line.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/([^\s/:@]*):([^\s/@]+)@/gi)) {
      if (!PLACEHOLDER.test(m[2])) findings.push({ line: idx + 1, rule: 'credentials in URL', kind: 'error' });
    }
    for (const m of [...line.matchAll(SECRET_ASSIGNMENT), ...line.matchAll(SECRET_TABLE_ROW)]) {
      const value = m[1];
      if (value.length >= 8 && !notASecretValue(value)) {
        findings.push({ line: idx + 1, rule: 'secret assignment', kind: 'error' });
        break;
      }
    }
    if (/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)(?!<|\$|\{)[A-Za-z0-9._-]+/.test(line)) {
      findings.push({ line: idx + 1, rule: 'personal home path', kind: 'warning' });
    }
  });
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Check

export function checkLog(root, rel) {
  const { dir, adrs, width } = loadLog(root, rel);
  const issues = [];
  const add = (kind, file, line, message) => issues.push({ kind, file: `${rel}/${file}`, line, message });
  const byNumber = new Map();
  for (const a of adrs) {
    if (!byNumber.has(a.number)) byNumber.set(a.number, []);
    byNumber.get(a.number).push(a);
  }
  for (const [n, list] of byNumber) {
    if (list.length > 1) {
      for (const a of list) add('error', a.file, 1, `${adrId(n, width)} is used by ${list.length} files (${list.map((x) => x.file).join(', ')}); renumber the one this branch added`);
    }
  }
  for (const a of adrs) {
    if (!a.title) add('error', a.file, 1, 'no title heading (# ADR-NNN: <decision>)');
    if (a.status === 'unknown') add('error', a.file, a.statusLine || 1, a.statusRaw ? `status "${a.statusRaw}" is not a known status` : 'no status');
    if (!a.date) add('warning', a.file, 1, 'no date (YYYY-MM-DD)');
    if (/[^\x20-\x7e]/.test(a.file)) add('warning', a.file, 1, 'file name is not ASCII');
    if (a.text.includes(TEMPLATE_MARK)) {
      const line = a.text.split('\n').findIndex((l) => l.includes(TEMPLATE_MARK)) + 1;
      add('error', a.file, line, 'template placeholder left in the ADR');
    }
    for (const n of a.supersedes) {
      const target = byNumber.get(n)?.[0];
      if (!target) {
        add('error', a.file, 1, `supersedes ${adrId(n, width)}, which does not exist in this log`);
      } else if (!['superseded', 'partially-superseded'].includes(target.status) || !referencedNumbers(target.statusRaw).includes(a.number)) {
        add('warning', target.file, target.statusLine || 1, `${adrId(a.number, width)} supersedes this ADR, but its status does not say so`);
      }
    }
    for (const n of a.supersededBy) {
      if (!byNumber.has(n)) add('error', a.file, a.statusLine || 1, `status names ${adrId(n, width)}, which does not exist in this log`);
    }
    for (const f of scanSecrets(a.text)) add(f.kind, a.file, f.line, `${f.rule}: an ADR is committed, so it must not carry this`);
  }

  // One log, one language: an ADR written in the other language than the rest is named.
  const byLanguage = { de: [], en: [] };
  for (const a of adrs) {
    const { lang } = classifyLanguage(a.text);
    if (byLanguage[lang]) byLanguage[lang].push(a);
  }
  if (byLanguage.de.length && byLanguage.en.length) {
    const [minority, majority] = byLanguage.de.length < byLanguage.en.length ? ['de', 'en'] : ['en', 'de'];
    for (const a of byLanguage[minority]) {
      add('warning', a.file, 1, `written in ${minority}, while ${byLanguage[majority].length} ADRs of this log are in ${majority}`);
    }
  }

  const readmePath = join(dir, 'README.md');
  const readme = readText(readmePath);
  if (readme) for (const f of scanSecrets(readme)) add(f.kind, 'README.md', f.line, `${f.rule}: the index is committed, so it must not carry this`);
  if (readme.includes(INDEX_START)) {
    const lang = detectLanguage(readme) === 'de' ? 'de' : 'en';
    const expected = replaceIndex(readme, renderIndex(adrs, width, lang));
    if (expected !== undefined && expected !== readme) add('error', 'README.md', 1, `index table is out of date: run "node adr.mjs index --write --log ${rel}"`);
  } else {
    const parentReadme = readText(join(dirname(dir), 'README.md'));
    for (const a of adrs) {
      if (!readme.includes(a.file) && !parentReadme.includes(a.file)) add('warning', a.file, 1, 'not listed in the log index');
    }
  }
  return { log: rel, adrs: adrs.length, issues };
}

// ---------------------------------------------------------------------------------------------
// Where a write may go

/** The real path of p, resolving symlinks of the part that exists, so a link cannot lead a write elsewhere. */
function realish(p) {
  let cur = resolve(p);
  const rest = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) break;
    rest.unshift(basename(cur));
    cur = parent;
  }
  let real = cur;
  try {
    real = realpathSync(cur);
  } catch {
    // keep the resolved path
  }
  return join(real, ...rest);
}

function isInside(child, parent) {
  const r = relative(parent, child);
  return r !== '' && !r.startsWith('..') && !isAbsolute(r);
}

/**
 * Why a write into the log at `rel` is refused, or undefined when it may go ahead. A log lies inside
 * the repository the helper runs in, and never in `.claude/` or `.git/`: Claude Code loads
 * instructions and hooks from there, and an auto-approved helper must not become a way to plant them.
 */
export function refuseWrite(root, rel, cwd) {
  const top = realish(repoRoot(cwd));
  const base = realish(root);
  if (base !== top && !isInside(base, top)) return `--root ${root} lies outside the repository ${top}`;
  const target = realish(isAbsolute(rel) ? rel : join(root, rel));
  if (!isInside(target, base)) return `the log ${rel} lies outside the repository`;
  if (relative(base, target).split(/[\\/]/).some((seg) => /^\.(claude|git)$/i.test(seg))) {
    return `refusing to write into ${rel}: .claude/ and .git/ hold instructions and hooks, not ADRs`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) args[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) args[a.slice(2)] = argv[++i];
      else args[a.slice(2)] = true;
    } else args._.push(a);
  }
  return args;
}

function numberList(value) {
  if (!value || value === true) return [];
  return String(value).split(/[,\s]+/).map((v) => Number(v.replace(/^ADR-?/i, ''))).filter((n) => Number.isInteger(n) && n > 0);
}

function resolveLog(root, args, logs) {
  if (args.log && args.log !== true) {
    const p = isAbsolute(args.log) ? relative(root, args.log) : args.log;
    return p.replace(/\/+$/, '') || '.';
  }
  // The repository's own decisions go into its root log. A subproject's log (one a starter brought along) is read,
  // never written by default: without a root log the default location is created.
  return logs.find((l) => LOG_DIR_NAMES.includes(l)) ?? DEFAULT_LOG;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(a, width) {
  if (a.status === 'superseded' || a.status === 'partially-superseded') {
    const by = a.supersededBy.map((n) => adrId(n, width)).join(', ');
    return by ? `${a.status} by ${by}` : a.status;
  }
  return a.status;
}

export function main(argv = process.argv.slice(2), cwd = process.cwd(), out = console) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const root = resolve(args.root && args.root !== true ? args.root : repoRoot(cwd));
  const logs = findLogs(root);
  const selected = args.log && args.log !== true ? [resolveLog(root, args, logs)] : logs;

  switch (cmd) {
    case 'find': {
      if (!logs.length) {
        out.log(`no ADR log in ${root} (default location: ${DEFAULT_LOG})`);
        return 2;
      }
      for (const l of logs) out.log(`${l}\t${adrFiles(join(root, l)).length} ADRs`);
      return 0;
    }
    case 'list': {
      if (!selected.length || !selected.some((l) => isDir(join(root, l)))) {
        out.log(`no ADR log in ${root}`);
        return 2;
      }
      const data = selected.map((l) => loadLog(root, l));
      if (args.json) {
        out.log(JSON.stringify(data.map(({ log, adrs, width }) => ({
          log,
          adrs: adrs
            .filter((a) => !args.active || !INACTIVE.has(a.status))
            .map(({ text, titleLine, statusLine, ...a }) => ({ id: adrId(a.number, width), ...a })),
        })), null, 2));
        return 0;
      }
      for (const { log, adrs, width } of data) {
        const shown = adrs.filter((a) => !args.active || !INACTIVE.has(a.status));
        const binding = adrs.filter((a) => BINDING.has(a.status)).length;
        out.log(`## ${log} (${adrs.length} ADRs, ${binding} binding)`);
        for (const a of shown) {
          out.log(`${adrId(a.number, width)} | ${statusLabel(a, width)} | ${a.date || '????-??-??'} | ${a.title}${a.topic ? ` [${a.topic}]` : ''} | ${log}/${a.file}`);
        }
      }
      return 0;
    }
    case 'next': {
      const rel = resolveLog(root, args, logs);
      const { width } = loadLog(root, rel);
      out.log(pad(nextNumber(root, rel), width));
      return 0;
    }
    case 'lang': {
      const rel = resolveLog(root, args, logs);
      const detected = projectLanguage(root, rel);
      if (args.json) out.log(JSON.stringify(detected, null, 2));
      else {
        out.log(`lang: ${detected.lang}`);
        out.log(`decided by: ${detected.decidedBy === 'log' ? `the log ${rel}` : 'the documentation'}`);
        for (const s of detected.sources) out.log(`  ${s.source}: ${s.lang} (de ${s.de}, en ${s.en})`);
        if (detected.lang === 'unclear') out.log('ask the developer which language the ADRs are written in, then pass --lang to init or new');
      }
      return detected.lang === 'unclear' ? 3 : 0;
    }
    case 'init': {
      const rel = resolveLog(root, args, logs);
      const dir = join(root, rel);
      const refused = refuseWrite(root, rel, cwd);
      if (refused) {
        out.error(refused);
        return 2;
      }
      const language = resolveLanguage(root, rel, args.lang);
      if (language.code) {
        out.error(language.message);
        return language.code;
      }
      const { lang } = language;
      mkdirSync(dir, { recursive: true });
      const readme = join(dir, 'README.md');
      if (existsSync(readme)) {
        out.log(`${rel}/README.md exists, left as it is`);
      } else if (adrFiles(dir).length) {
        // An established log without a README of its own keeps its index elsewhere (often docs/README.md).
        out.log(`${rel} already holds ADRs and keeps its index elsewhere; no README created`);
      } else {
        writeFileSync(readme, readmeTemplate(lang));
        out.log(`created ${rel}/README.md (${lang})`);
      }
      return 0;
    }
    case 'new': {
      if (!args.title || args.title === true) {
        out.error('new needs --title "<one sentence that states the decision>"');
        return 2;
      }
      const rel = resolveLog(root, args, logs);
      const dir = join(root, rel);
      const refused = refuseWrite(root, rel, cwd);
      if (refused) {
        out.error(refused);
        return 2;
      }
      const language = resolveLanguage(root, rel, args.lang);
      if (language.code) {
        out.error(language.message);
        return language.code;
      }
      const { lang } = language;
      if (!existsSync(join(dir, 'README.md')) && !adrFiles(dir).length) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'README.md'), readmeTemplate(lang));
      }
      const before = loadLog(root, rel);
      const width = before.width;
      const number = nextNumber(root, rel);
      const file = `${pad(number, width)}-${slugify(args.title)}.md`;
      const supersedes = numberList(args.supersedes);
      const partial = numberList(args['partially-supersedes']);
      const files = Object.fromEntries(before.adrs.map((a) => [a.number, a.file]));
      for (const n of [...supersedes, ...partial]) {
        if (!files[n]) {
          out.error(`${adrId(n, width)} does not exist in ${rel}`);
          return 2;
        }
      }
      const w = WORDS[lang];
      const ascii = lang === 'de' && asciiGerman(dir);
      const status = args.status === 'proposed' ? w.proposed : w.accepted;
      const text = adrTemplate({
        number, width, title: args.title, date: args.date && args.date !== true ? args.date : today(),
        status: ascii ? asciiFold(status) : status, topic: args.topic === true ? '' : args.topic,
        supersedes, partial, origin: args.origin === true ? '' : args.origin, lang, files,
      });
      writeFileSync(join(dir, file), text);
      out.log(`created ${rel}/${file}`);
      for (const [list, phrase] of [[supersedes, w.supersededBy], [partial, w.partiallySupersededBy]]) {
        for (const n of list) {
          const oldPath = join(dir, files[n]);
          const value = `${ascii ? asciiFold(phrase) : phrase} [${adrId(number, width)}](${file})`;
          const updated = markSuperseded(readText(oldPath), value);
          if (updated === undefined) out.log(`set the status of ${rel}/${files[n]} by hand: ${value}`);
          else {
            writeFileSync(oldPath, updated);
            out.log(`marked ${rel}/${files[n]}: ${value}`);
          }
        }
      }
      const readme = readText(join(dir, 'README.md'));
      if (readme.includes(INDEX_START)) {
        const after = loadLog(root, rel);
        writeFileSync(join(dir, 'README.md'), replaceIndex(readme, renderIndex(after.adrs, width, detectLanguage(readme))));
        out.log(`updated ${rel}/README.md index`);
      } else {
        out.log(`add ${file} to the log's index by hand (no ${INDEX_START} marker)`);
      }
      return 0;
    }
    case 'index': {
      let status = 0;
      for (const rel of selected) {
        const { dir, adrs, width } = loadLog(root, rel);
        const readmePath = join(dir, 'README.md');
        const readme = readText(readmePath);
        if (!readme.includes(INDEX_START)) {
          out.log(`${rel}: no index markers, the table is kept by hand`);
          continue;
        }
        const next = replaceIndex(readme, renderIndex(adrs, width, detectLanguage(readme)));
        if (next === readme) out.log(`${rel}: index is current`);
        else if (args.write && refuseWrite(root, rel, cwd)) {
          out.error(refuseWrite(root, rel, cwd));
          status = 2;
        } else if (args.write) {
          writeFileSync(readmePath, next);
          out.log(`${rel}: index rewritten (${adrs.length} ADRs)`);
        } else {
          out.log(`${rel}: index is out of date (run with --write)`);
          status = 1;
        }
      }
      return status;
    }
    case 'check': {
      if (!selected.length) {
        out.log(`no ADR log in ${root}`);
        return 2;
      }
      const results = selected.map((rel) => checkLog(root, rel));
      const issues = results.flatMap((r) => r.issues);
      const errors = issues.filter((i) => i.kind === 'error').length;
      if (args.json) out.log(JSON.stringify({ results, errors, warnings: issues.length - errors }, null, 2));
      else {
        for (const i of issues) out.log(`${i.kind.toUpperCase()} ${i.file}:${i.line} ${i.message}`);
        out.log(`adr check: ${results.length} log(s), ${results.reduce((s, r) => s + r.adrs, 0)} ADRs, ${errors} error(s), ${issues.length - errors} warning(s)`);
      }
      return errors ? 1 : 0;
    }
    default:
      out.error('usage: adr.mjs <find|list|next|lang|init|new|index|check> [options] (see the header of this file)');
      return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main();
}
