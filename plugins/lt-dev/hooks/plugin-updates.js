// Keeps the lenne.Tech plugins of a machine current while its interactive sessions run:
//
// 1. Update: when the last background update on this machine is older than
//    UPDATE_INTERVAL_MS (twice a day), start scripts/update-lt-plugins-scheduled.sh, which
//    runs `lt claude plugins` detached under the same lock and state as the SessionStart
//    updater. A machine whose sessions stay open for days gets releases anyway.
// 2. Reload: once installed_plugins.json shows a newer version of a plugin from the
//    lenne.Tech marketplaces, run /reload-plugins in this session, at once when the session
//    is idle, otherwise when the running turn ends.
//
// Cost model: no model call and no tokens while nothing changes. A timer reads two small
// files every CHECK_INTERVAL_MS; the end of a turn only checks a flag. One reload per
// release, without --force: skills, commands, agents and hooks keep the prompt cache, and a
// reload that would change plugin MCP tools is skipped by Claude Code and reported here.
//
// Measured on Claude Code 2.1.322 (2026-11-11): `$.command.run('reload-plugins')` works from
// `turn.complete` in an interactive session, is refused inside a `command.run` hook ("would
// wait on the turn this hook is holding"), and is unavailable in `claude -p`.
//
// The mod loader follows `$` statically: a function that receives it is declared at the top
// of this file.

/** Marketplaces whose releases a running session picks up on its own. */
export const MARKETPLACES = ['lenne-tech', 'lenne-tech-internal']

/** How often an interactive session reads the install record and the last update time. */
export const CHECK_INTERVAL_MS = 10 * 60 * 1000

/** Twice a day; LT_PLUGINS_SCHEDULE_SECONDS in scripts/_lt-plugins-config.sh says the same. */
export const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000

/** One session starts the update script at most this often, even when its run leaves no trace. */
export const UPDATE_RETRY_MS = 60 * 60 * 1000

/**
 * Where a plugin loaded from the plugin cache keeps its files:
 * `<config>/plugins/cache/<marketplace>/<plugin>/<version>` gives the install record
 * `<config>/plugins/installed_plugins.json` and the data directory
 * `<config>/plugins/data/<plugin>-<marketplace>` (CLAUDE_PLUGIN_DATA). Null for a plugin
 * loaded from anywhere else, such as `--plugin-dir`.
 */
export function cacheLayout(pluginRoot) {
  const m = /^(.*)([\\/])plugins[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/][^\\/]+[\\/]?$/.exec(pluginRoot || '')
  if (!m) return null
  const [, config, sep, marketplace, plugin] = m
  const id = `${plugin}@${marketplace}`.replace(/[^A-Za-z0-9_-]/g, '-')
  return {
    recordPath: [config, 'plugins', 'installed_plugins.json'].join(sep),
    dataDir: [config, 'plugins', 'data', id].join(sep),
    sep,
  }
}

/**
 * The scheduled update script under a plugin root, joined with `/` as hooks.json does
 * (`${CLAUDE_PLUGIN_ROOT}/hooks/…`): the script finds its siblings through `${0%/*}` and
 * `dirname "$0"`, which split on `/` only, and Git Bash opens a Windows root with `/` appended.
 */
export function scheduledScriptFor(pluginRoot) {
  return `${String(pluginRoot).replace(/[\\/]+$/, '')}/hooks/scripts/update-lt-plugins-scheduled.sh`
}

/** The install record under a config directory (CLAUDE_CONFIG_DIR), or null without one. */
export function installRecordIn(configDir) {
  if (!configDir) return null
  const sep = configDir.includes('\\') && !configDir.includes('/') ? '\\' : '/'
  return [configDir.replace(/[\\/]+$/, ''), 'plugins', 'installed_plugins.json'].join(sep)
}

/** Whether the last update (epoch seconds, as the updater writes it) is older than twice a day. */
export function updateDue(lastRunText, nowMs) {
  const seconds = Number(String(lastRunText ?? '').trim())
  if (!Number.isFinite(seconds) || seconds <= 0) return true
  return nowMs - seconds * 1000 >= UPDATE_INTERVAL_MS
}

/**
 * The watched plugins in an install record, keyed `name@marketplace`, each with the
 * version shown to the user and an id that changes with every install. Null when the
 * text is not a readable record, such as a file caught halfway through a write.
 */
export function snapshotOf(recordText) {
  let record
  try {
    record = JSON.parse(recordText)
  } catch {
    return null
  }
  const plugins = record && typeof record === 'object' ? record.plugins : null
  if (!plugins || typeof plugins !== 'object') return null
  const snapshot = {}
  for (const key of Object.keys(plugins).sort()) {
    const at = key.lastIndexOf('@')
    const entries = plugins[key]
    if (at <= 0 || !MARKETPLACES.includes(key.slice(at + 1)) || !Array.isArray(entries)) continue
    const versions = entries.map((entry) => String(entry?.version ?? '?'))
    snapshot[key] = {
      version: [...new Set(versions)].sort().join(', '),
      id: entries
        .map((entry) => [entry?.scope, entry?.version, entry?.gitCommitSha, entry?.installPath].join('|'))
        .sort()
        .join(';'),
    }
  }
  return snapshot
}

/** One string per snapshot, equal exactly when no watched plugin changed. */
export function idOf(snapshot) {
  return JSON.stringify(Object.entries(snapshot ?? {}).map(([key, value]) => [key, value.id]))
}

/**
 * What changed between two snapshots, plugins with the same move grouped:
 * `lt-dev, lt-tools 8.40.5 → 8.40.6; lt-time 0.14.4 added`.
 */
export function describeChanges(before, after) {
  const groups = new Map()
  const add = (label, key) => groups.set(label, [...(groups.get(label) ?? []), key.slice(0, key.lastIndexOf('@'))])
  for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
    const from = before?.[key]
    const to = after?.[key]
    if (from && to && from.id === to.id) continue
    if (!from) add(`${to.version} added`, key)
    else if (!to) add('removed', key)
    else if (from.version === to.version) add(`${to.version} reinstalled`, key)
    else add(`${from.version} → ${to.version}`, key)
  }
  return [...groups].map(([label, names]) => `${names.sort().join(', ')} ${label}`).join('; ')
}

async function readSnapshot($, state) {
  try {
    return snapshotOf(await $.fs.read(state.recordPath))
  } catch {
    return null
  }
}

async function startDueUpdate($, state) {
  if (!state.dataDir) return
  const now = await $.clock.now()
  if (state.updateStartedAt !== null && now - state.updateStartedAt < UPDATE_RETRY_MS) return
  let lastRun = ''
  try {
    lastRun = await $.fs.read(`${state.dataDir}${state.sep}update-last-run`)
  } catch {
    // No run recorded yet on this machine: the update is due.
  }
  if (!updateDue(lastRun, now)) return
  state.updateStartedAt = now
  try {
    // Returns at once: the script re-checks schedule and lock, then detaches the updater.
    await $.process.run(['bash', state.updateScript], {
      env: { CLAUDE_PLUGIN_ROOT: state.pluginRoot, CLAUDE_PLUGIN_DATA: state.dataDir },
      timeoutMs: 30_000,
    })
  } catch {
    // No bash, or the run was refused: the SessionStart updater still runs on the next start.
  }
}

async function reload($, state) {
  const target = state.pending
  state.pending = null
  const changed = describeChanges(state.loaded, target)
  let output = ''
  try {
    output = (await $.command.run({ command: 'reload-plugins', args: '' }))?.text ?? ''
  } catch (error) {
    state.declined = idOf(target)
    await $.ui.log(`plugins not reloaded (${changed}): ${error?.message ?? error}. Run /reload-plugins.`)
    return
  }
  if (/\bReloaded\b/.test(output)) {
    state.loaded = target
    await $.ui.log(`reloaded plugins: ${changed}`)
    return
  }
  state.declined = idOf(target)
  const hint = /--force/.test(output)
    ? 'The new versions change plugin MCP servers, which would invalidate the prompt cache. Run /reload-plugins --force, or start a new session.'
    : 'Run /reload-plugins.'
  await $.ui.log(`plugins not reloaded (${changed}). ${hint}`)
}

async function check($, state) {
  if (state.checking) return
  state.checking = true
  try {
    await startDueUpdate($, state)
    const current = await readSnapshot($, state)
    if (!current) return
    if (!state.loaded) {
      state.loaded = current
      return
    }
    const id = idOf(current)
    if (id === idOf(state.loaded) || id === state.declined) return
    state.pending = current
    if (!state.turnRunning) await reload($, state)
  } finally {
    state.checking = false
  }
}

/** Wires update and reload into the module's events. */
export function registerPluginUpdates(on) {
  const state = {
    pluginRoot: null,
    recordPath: null,
    dataDir: null, // set only for a plugin loaded from the cache
    sep: '/',
    updateScript: null,
    updateStartedAt: null,
    loaded: null, // what this session runs on
    declined: null, // id of a snapshot whose reload did not apply; not tried again
    pending: null, // snapshot waiting for the main-loop turn to end
    turnRunning: false,
    checking: false,
    timer: null,
  }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    // A run that draws nowhere (`claude -p`, a bare SDK call) is over before a release lands.
    // The Desktop app draws but is not interactive: it gets the update, and a reload it refuses
    // ends in one log line per release that names /reload-plugins.
    if (!e.isInteractive && !e.surface) return result
    const root = $.plugin.root
    const layout = cacheLayout(root)
    state.pluginRoot = root
    state.recordPath = layout?.recordPath ?? installRecordIn(await $.env.get('CLAUDE_CONFIG_DIR'))
    if (!state.recordPath) return result
    if (layout) {
      state.dataDir = layout.dataDir
      state.sep = layout.sep
      state.updateScript = scheduledScriptFor(root)
    }
    state.loaded = await readSnapshot($, state)
    state.timer?.cancel()
    state.timer = $.clock.every(CHECK_INTERVAL_MS, () => check($, state))
    return result
  })

  on('turn.start', async (_$, e, next) => {
    if (!e.agentId) state.turnRunning = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      state.turnRunning = false
      if (state.pending) await reload($, state)
    }
    return next(e)
  })
}
