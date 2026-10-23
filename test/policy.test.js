import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, atDesk, DEFAULTS } from '../src/policy.js'

const now = 1_800_000_000_000
const desk = (someone = true, voice = 'resting', online = true) => ({
  deviceId: 'lamp', online,
  topics: { 'room/presence': { value: { someone, nobody_s: 0 } }, 'voice/state': { value: { state: voice } } },
})
const note = (urgency = 'normal', id = 'n1') => ({ id, kind: 'messages', count: 2, urgency, at: now - 5000, expiresAt: now + 60_000 })

test('only someone at the desk with the voice resting is a moment', () => {
  assert.equal(atDesk(desk()), true)
  assert.equal(atDesk(desk(false)), false)
  assert.equal(atDesk(desk(true, 'speaking')), false)
  assert.equal(atDesk(desk(true, 'resting', false)), false)
  assert.equal(atDesk(null), false)
})

test('light first; a say only for urgent notes with say on', () => {
  assert.equal(decide([note('urgent')], desk(), [], now).propose.act, 'light')
  const say = decide([note('urgent')], desk(), [], now, { ...DEFAULTS, say: true }).propose
  assert.equal(say.act, 'say')
  assert.match(say.note, /urgent/)
  assert.equal(decide([note('normal')], desk(), [], now, { ...DEFAULTS, say: true }).propose.act, 'light')
})

test('our own limits hold before the lamp is asked', () => {
  assert.equal(decide([], desk(), [], now).wait, 'no_notes')
  assert.equal(decide([note()], desk(false), [], now).wait, 'not_at_desk')
  assert.equal(decide([note()], desk(), [{ at: now, decision: 'open' }], now).wait, 'open_proposal')
  assert.equal(decide([note()], desk(), [{ at: now - 60_000, decision: 'kept' }], now).wait, 'min_gap')
  assert.equal(decide([note()], desk(), [{ at: now - 60_000, decision: 'dropped' }], now).wait, 'after_drop')
  const six = Array.from({ length: 6 }, (_, i) => ({ at: now - 400_000 - i * 400_000, decision: 'kept' }))
  assert.equal(decide([note()], desk(), six, now).wait, 'per_hour')
})

test('the most urgent note goes first', () => {
  assert.equal(decide([note('low', 'a'), note('urgent', 'b')], desk(), [], now).propose.noteId, 'b')
})
