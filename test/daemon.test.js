import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAddon } from '../src/daemon.js'
import { harnessLink } from '../src/lamp.js'

const fake = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-harness.js')

function rig(decision = 'kept', someone = true) {
  const dir = mkdtempSync(join(tmpdir(), 'lamp-addon-'))
  const inbox = join(dir, 'inbox'), calls = join(dir, 'calls'), state = join(dir, 'state.json')
  writeFileSync(state, JSON.stringify({ devices: [{ deviceId: 'lamp', online: true, topics: {
    'room/presence': { value: { someone } }, 'voice/state': { value: { state: 'resting' } } } }] }))
  process.env.FAKE_STATE = state; process.env.FAKE_CALLS = calls; process.env.FAKE_DECISION = decision
  delete process.env.FAKE_PROPOSE_ERROR
  let t = Date.now()
  const addon = createAddon({ inbox, link: harnessLink({ bin: fake }), now: () => t })
  return { addon, inbox, calls: () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)), tick: (ms) => { t += ms } }
}
function put(inbox, id, extra = {}) {
  mkdirSync(inbox, { recursive: true })
  writeFileSync(join(inbox, `${id}.json`),
    JSON.stringify({ v: 1, id, kind: 'messages', count: 1, urgency: 'normal', at: Date.now(), ...extra }))
}

test('a note becomes one light proposal, and a kept one is filed as done', async () => {
  const r = rig('kept')
  assert.equal((await r.addon.step()).wait, 'no_notes')
  put(r.inbox, 'n1')
  const sent = await r.addon.step()
  assert.equal(sent.act, 'light')
  const propose = r.calls().find((c) => c[2] === 'propose')
  assert.deepEqual(propose.slice(propose.indexOf('--addon'), propose.indexOf('--addon') + 4), ['--addon', 'devin-slack', '--act', 'light'])
  assert.ok(!propose.includes('--note'))
  await r.addon.step()
  assert.ok(existsSync(join(r.inbox, 'done', 'n1.json')))
  assert.equal(r.addon.history[0].decision, 'kept')
  assert.equal((await r.addon.step()).wait, 'no_notes')
})

test('a dropped proposal keeps its note and backs off', async () => {
  const r = rig('dropped')
  put(r.inbox, 'n2')
  await r.addon.step(); await r.addon.step()
  assert.ok(existsSync(join(r.inbox, 'n2.json')))
  assert.equal((await r.addon.step()).wait, 'after_drop')
  r.tick(5 * 60_000 + 1)
  assert.ok((await r.addon.step()).proposed)
})

test('nobody at the desk: nothing is proposed', async () => {
  const r = rig('kept', false)
  put(r.inbox, 'n3')
  assert.equal((await r.addon.step()).wait, 'not_at_desk')
  assert.ok(!r.calls().some((c) => c[2] === 'propose'))
})

test('a note carrying text is dropped from the inbox unread', async () => {
  const r = rig()
  put(r.inbox, 'n4', { text: 'secret' })
  assert.equal((await r.addon.step()).wait, 'no_notes')
  assert.ok(!existsSync(join(r.inbox, 'n4.json')))
})

test('a propose with an unknown outcome is retried with the same key; any other failure gets a new one', async () => {
  const r = rig('kept')
  put(r.inbox, 'n5')
  const keys = () => r.calls().filter((c) => c[2] === 'propose').map((c) => c[c.indexOf('--key') + 1])
  process.env.FAKE_PROPOSE_ERROR = 'OUTCOME_UNKNOWN'
  assert.ok((await r.addon.step()).failed)
  r.tick(5 * 60_000 + 1)
  process.env.FAKE_PROPOSE_ERROR = 'RATE_LIMITED'
  assert.ok((await r.addon.step()).failed)
  r.tick(5 * 60_000 + 1)
  delete process.env.FAKE_PROPOSE_ERROR
  assert.ok((await r.addon.step()).proposed)
  const [first, second, third] = keys()
  assert.equal(second, first)
  assert.notEqual(third, second)
})

test('a note still being written is left for the next read; a stale broken one is dropped', async () => {
  const r = rig()
  mkdirSync(r.inbox, { recursive: true })
  const path = join(r.inbox, 'n6.json')
  writeFileSync(path, '{"v": 1, "id": "n6", "ki')
  assert.equal((await r.addon.step()).wait, 'no_notes')
  assert.ok(existsSync(path))
  const old = new Date(Date.now() - 60_000)
  utimesSync(path, old, old)
  await r.addon.step()
  assert.ok(!existsSync(path))
})

test('a note whose id was already handled is dropped, not nudged again', async () => {
  const r = rig('kept')
  put(r.inbox, 'n7')
  assert.ok((await r.addon.step()).proposed)
  await r.addon.step()
  assert.ok(existsSync(join(r.inbox, 'done', 'n7.json')))
  put(r.inbox, 'n7')
  r.tick(10 * 60_000)
  assert.equal((await r.addon.step()).wait, 'no_notes')
  assert.ok(!existsSync(join(r.inbox, 'n7.json')))
})
