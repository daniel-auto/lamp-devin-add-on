import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNote, sayLine } from '../src/note.js'

const now = 1_800_000_000_000
const good = { v: 1, id: 'n1', kind: 'messages', count: 3, urgency: 'urgent', at: now - 1000 }

test('a well formed note is taken, with a default expiry of an hour', () => {
  const r = parseNote(good, now)
  assert.equal(r.ok, true)
  assert.equal(r.note.expiresAt, good.at + 3_600_000)
})

test('anything that could carry Slack text is refused', () => {
  assert.equal(parseNote({ ...good, text: 'hi' }, now).why, 'unknown_field:text')
  assert.equal(parseNote({ ...good, from: 'Lead' }, now).why, 'unknown_field:from')
  assert.equal(parseNote({ ...good, kind: 'secrets' }, now).why, 'kind')
  assert.equal(parseNote({ ...good, count: 0 }, now).why, 'count')
  assert.equal(parseNote({ ...good, expiresAt: good.at }, now).why, 'expiresAt')
  assert.equal(parseNote({ ...good, at: now - 7_200_000 }, now).why, 'expired')
})

test('the spoken line is built from fields alone, on one line, within 300 bytes', () => {
  const line = sayLine(parseNote(good, now).note)
  assert.equal(line, 'You have 3 Slack messages, one looks urgent.')
  assert.ok(Buffer.byteLength(line) <= 300 && !/[\x00-\x1f\x7f]/.test(line))
})

test('a summary is the whole spoken line, up to Harness\'s 300 bytes', () => {
  const summary = 'Your lead asked for the deploy notes by 3 pm; the other two are status updates.'
  const r = parseNote({ ...good, summary: `  ${summary} ` }, now)
  assert.equal(r.ok, true)
  assert.equal(sayLine(r.note), summary)
  assert.equal(parseNote({ ...good, summary: 'ễ'.repeat(100) }, now).ok, true) // 300 bytes
  assert.equal(parseNote({ ...good, summary: 'ễ'.repeat(101) }, now).why, 'summary_too_long')
})

test('a summary the lamp would refuse is refused here first', () => {
  assert.equal(parseNote({ ...good, summary: '' }, now).why, 'summary')
  assert.equal(parseNote({ ...good, summary: 42 }, now).why, 'summary')
  assert.equal(parseNote({ ...good, summary: 'two\nlines' }, now).why, 'summary_control')
  assert.equal(parseNote({ ...good, summary: 'see https://x.io' }, now).why, 'summary_link_or_handle')
  assert.equal(parseNote({ ...good, summary: 'from <@U123>' }, now).why, 'summary_link_or_handle')
})

test('a note may carry its messages for Claude here, within limits', () => {
  assert.deepEqual(parseNote({ ...good, messages: ['Deploy notes by 3?', 'CI is green'] }, now).note.messages, ['Deploy notes by 3?', 'CI is green'])
  assert.equal(parseNote({ ...good, messages: [] }, now).why, 'messages')
  assert.equal(parseNote({ ...good, messages: [42] }, now).why, 'messages')
  assert.equal(parseNote({ ...good, messages: ['x'.repeat(4001)] }, now).why, 'messages')
  assert.equal(parseNote({ ...good, messages: Array(51).fill('hi') }, now).why, 'messages')
})
