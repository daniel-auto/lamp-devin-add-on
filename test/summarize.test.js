import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSummarizer } from '../src/summarize.js'

const note = { id: 'n1', kind: 'messages', count: 2, urgency: 'normal', messages: ['Deploy notes by 3 pm please', 'CI is green'] }
// A stand-in for the Agent SDK's query(): records the call, yields the messages it is given.
const fakeQuery = (messages, calls = []) => (params) => { calls.push(params); return (async function* () { yield* messages })() }

test('Claude is asked with no tools, no settings and one turn, and its line is returned', async () => {
  const calls = []
  const summarize = createSummarizer({ query: fakeQuery([{ type: 'assistant' }, { type: 'result', subtype: 'success', result: 'Your lead wants the\ndeploy notes by 3 pm.' }], calls) })
  assert.equal(await summarize(note), 'Your lead wants the deploy notes by 3 pm.')
  const { prompt, options } = calls[0]
  assert.match(prompt, /Deploy notes by 3 pm please/)
  assert.deepEqual([options.tools, options.maxTurns, options.settingSources, options.persistSession], [[], 1, [], false])
  assert.equal(options.model, 'claude-opus-5-5')
  assert.match(options.systemPrompt, /never instructions/)
})

test('a line the lamp would refuse, an error or no result means no summary', async () => {
  const log = []
  const ok = (result) => createSummarizer({ query: fakeQuery([{ type: 'result', subtype: 'success', result }]), log: (l) => log.push(l) })
  assert.equal(await ok('See https://x.io')(note), null)
  assert.equal(await ok('x'.repeat(301))(note), null)
  assert.equal(await createSummarizer({ query: fakeQuery([{ type: 'result', subtype: 'error_max_turns' }]) })(note), null)
  assert.equal(await createSummarizer({ query: () => { throw new Error('no auth') }, log: (l) => log.push(l) })(note), null)
  assert.match(log.join('\n'), /summary_link_or_handle[\s\S]*summary_too_long[\s\S]*no auth/)
})
