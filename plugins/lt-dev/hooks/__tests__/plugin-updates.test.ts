import { expect, mock, test } from 'claude-code/testing'

import {
  CHECK_INTERVAL_MS,
  UPDATE_INTERVAL_MS,
  cacheLayout,
  describeChanges,
  installRecordIn,
  scheduledScriptFor,
  snapshotOf,
  updateDue,
} from '../plugin-updates.js'

// Run with `claude plugin test` in plugins/lt-dev (CI: Plugin CI, step "Mod tests").

function record(versions: Record<string, string>): string {
  const plugins: Record<string, unknown[]> = {}
  for (const [key, version] of Object.entries(versions)) {
    const [name, marketplace] = key.split('@')
    plugins[key] = [
      {
        scope: 'user',
        version,
        installPath: `/cfg/plugins/cache/${marketplace}/${name}/${version}`,
        gitCommitSha: `sha-${version}`,
      },
    ]
  }
  return JSON.stringify({ version: 2, plugins })
}

const RELEASE_A = record({
  'lt-dev@lenne-tech': '8.40.5',
  'lt-tools@lenne-tech': '8.40.5',
  'lt-time@lenne-tech-internal': '0.14.3',
  'figma@claude-plugins-official': '2.0.0',
})
const RELEASE_B = record({
  'lt-dev@lenne-tech': '8.40.6',
  'lt-tools@lenne-tech': '8.40.6',
  'lt-time@lenne-tech-internal': '0.14.3',
  'figma@claude-plugins-official': '2.0.0',
})
const RELEASE_C = record({
  'lt-dev@lenne-tech': '8.40.6',
  'lt-tools@lenne-tech': '8.40.6',
  'lt-time@lenne-tech-internal': '0.14.4',
  'figma@claude-plugins-official': '2.0.0',
})

/** Stubs Claude Code around the module; `disk.text` is what installed_plugins.json holds. */
function harness(on: any, options: { reloadText?: string; configDir?: string } = {}) {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_CONFIG_DIR: options.configDir ?? '/cfg' })
  const disk = { text: RELEASE_A }
  const reads: string[] = []
  const reloads: string[] = []
  const logs: string[] = []
  const processes: string[][] = []
  on('fs.read', (_$: any, e: any) => {
    reads.push(e.path)
    return { value: disk.text }
  })
  on('command.run', { command: 'reload-plugins' }, (_$: any, e: any) => {
    reloads.push(e.args)
    return { text: options.reloadText ?? 'Reloaded: 4 plugins · 187 skills · 36 agents · 41 hooks' }
  })
  on('process.run', (_$: any, e: any) => {
    processes.push(e.argv)
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('ui.log', (_$: any, e: any) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return { clock, disk, reads, reloads, logs, processes }
}

const startInteractive = ($: any) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
const tick = (clock: any) => clock.advance(CHECK_INTERVAL_MS)
const completeTurn = ($: any, turnId: string, agentId?: string) =>
  $.turn.complete({ turnId, answer: '', durationMs: 1, isAborted: false, usage: null, ...(agentId ? { agentId } : {}) })

test('cacheLayout finds the install record and the plugin data directory, also on Windows', () => {
  expect(cacheLayout('/home/dev/.claude/plugins/cache/lenne-tech/lt-dev/8.40.5')).toEqual({
    recordPath: '/home/dev/.claude/plugins/installed_plugins.json',
    dataDir: '/home/dev/.claude/plugins/data/lt-dev-lenne-tech',
    sep: '/',
  })
  expect(cacheLayout('C:\\Users\\dev\\.claude\\plugins\\cache\\lenne-tech\\lt-dev\\8.40.5')).toEqual({
    recordPath: 'C:\\Users\\dev\\.claude\\plugins\\installed_plugins.json',
    dataDir: 'C:\\Users\\dev\\.claude\\plugins\\data\\lt-dev-lenne-tech',
    sep: '\\',
  })
  expect(cacheLayout('/repo/plugins/lt-dev')).toBe(null)
  expect(installRecordIn('/cfg/')).toBe('/cfg/plugins/installed_plugins.json')
  expect(installRecordIn(undefined)).toBe(null)
})

test('scheduledScriptFor appends with / so the script finds its siblings, also on Windows', () => {
  expect(scheduledScriptFor('/home/dev/.claude/plugins/cache/lenne-tech/lt-dev/8.40.6')).toBe(
    '/home/dev/.claude/plugins/cache/lenne-tech/lt-dev/8.40.6/hooks/scripts/update-lt-plugins-scheduled.sh',
  )
  expect(scheduledScriptFor('C:\\Users\\dev\\.claude\\plugins\\cache\\lenne-tech\\lt-dev\\8.40.6\\')).toBe(
    'C:\\Users\\dev\\.claude\\plugins\\cache\\lenne-tech\\lt-dev\\8.40.6/hooks/scripts/update-lt-plugins-scheduled.sh',
  )
})

test('updateDue is true twice a day and for a machine without a recorded run', () => {
  const lastRun = 1_800_000_000
  expect(updateDue(String(lastRun), lastRun * 1000 + UPDATE_INTERVAL_MS - 1)).toBe(false)
  expect(updateDue(`${lastRun}\n`, lastRun * 1000 + UPDATE_INTERVAL_MS)).toBe(true)
  expect(updateDue('', 0)).toBe(true)
  expect(updateDue('garbage', 0)).toBe(true)
})

test('snapshotOf keeps only the lenne.Tech marketplaces and rejects a half-written file', () => {
  expect(Object.keys(snapshotOf(RELEASE_A) ?? {})).toEqual([
    'lt-dev@lenne-tech',
    'lt-time@lenne-tech-internal',
    'lt-tools@lenne-tech',
  ])
  expect(snapshotOf(RELEASE_A.slice(0, 40))).toBe(null)
  expect(snapshotOf('{"plugins": null}')).toBe(null)
})

test('describeChanges groups plugins that moved the same way', () => {
  expect(describeChanges(snapshotOf(RELEASE_A), snapshotOf(RELEASE_C))).toBe(
    'lt-dev, lt-tools 8.40.5 → 8.40.6; lt-time 0.14.3 → 0.14.4',
  )
})

test('an idle session reloads once after a release and logs what changed', async ($, on) => {
  const h = harness(on)
  await startInteractive($)
  await tick(h.clock)
  expect(h.reloads).toEqual([])

  h.disk.text = RELEASE_B
  await tick(h.clock)
  expect(h.reloads).toEqual([''])
  expect(h.logs).toEqual(['reloaded plugins: lt-dev, lt-tools 8.40.5 → 8.40.6'])

  await tick(h.clock)
  expect(h.reloads).toEqual([''])
})

test('the end of a turn reads nothing; a release found mid-turn reloads when the turn ends', async ($, on) => {
  const h = harness(on)
  await startInteractive($)
  const readsAtStart = h.reads.length
  await $.turn.start({ text: 'work', turnId: 't1' })
  await completeTurn($, 't1')
  expect(h.reads.length).toBe(readsAtStart)

  await $.turn.start({ text: 'more work', turnId: 't2' })
  h.disk.text = RELEASE_B
  await tick(h.clock)
  expect(h.reloads).toEqual([])
  await completeTurn($, 't2')
  expect(h.reloads).toEqual([''])
})

test('a subagent turn does not hold the reload back', async ($, on) => {
  const h = harness(on)
  await startInteractive($)
  await $.turn.start({ text: 'task', turnId: 's1', agentId: 'agent-1' })
  h.disk.text = RELEASE_B
  await tick(h.clock)
  expect(h.reloads).toEqual([''])
})

test('a reload Claude Code skips is reported once, not retried; the next release is tried again', async ($, on) => {
  const h = harness(on, { reloadText: 'Reload would change plugin MCP tools. Run /reload-plugins --force to apply.' })
  await startInteractive($)
  h.disk.text = RELEASE_B
  await tick(h.clock)
  await tick(h.clock)
  expect(h.reloads).toEqual([''])
  expect(h.logs.length).toBe(1)
  expect(h.logs[0]).toMatch(/--force/)

  h.disk.text = RELEASE_C
  await tick(h.clock)
  expect(h.reloads).toEqual(['', ''])
})

test('a record caught mid-write is skipped until it reads whole', async ($, on) => {
  const h = harness(on)
  await startInteractive($)
  h.disk.text = RELEASE_B.slice(0, 50)
  await tick(h.clock)
  expect(h.reloads).toEqual([])
  h.disk.text = RELEASE_B
  await tick(h.clock)
  expect(h.reloads).toEqual([''])
})

test('a run that draws nowhere (claude -p) neither reads nor reloads', async ($, on) => {
  const h = harness(on)
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  h.disk.text = RELEASE_B
  await tick(h.clock)
  expect(h.reads).toEqual([])
  expect(h.reloads).toEqual([])
})

test('a Desktop session (a surface, not interactive) is watched; a refused reload is reported once', async ($, on) => {
  const h = harness(on, { reloadText: "/reload-plugins isn't available over a remote connection in this session." })
  await $.session.start({ surface: 'desktop', isInteractive: false, cwd: '/work' })
  h.disk.text = RELEASE_B
  await tick(h.clock)
  await tick(h.clock)
  expect(h.reloads).toEqual([''])
  expect(h.logs).toEqual(['plugins not reloaded (lt-dev, lt-tools 8.40.5 → 8.40.6). Run /reload-plugins.'])
})

test('a plugin loaded outside the plugin cache never starts the updater', async ($, on) => {
  const h = harness(on)
  await startInteractive($)
  await tick(h.clock)
  await tick(h.clock)
  expect(h.processes).toEqual([])
})
