#!/usr/bin/env node
// A stand-in Harness CLI: state from $FAKE_STATE, records calls to $FAKE_CALLS,
// decides every proposal as $FAKE_DECISION (default kept).
import { readFileSync, appendFileSync, existsSync } from 'node:fs'
const args = process.argv.slice(2)
if (process.env.FAKE_CALLS) appendFileSync(process.env.FAKE_CALLS, JSON.stringify(args) + '\n')
const verb = args[2]
const flag = (f) => { const i = args.indexOf(f); return i < 0 ? undefined : args[i + 1] }
const out = (v) => console.log(JSON.stringify(v))
if (verb === 'state') {
  out(existsSync(process.env.FAKE_STATE ?? '') ? JSON.parse(readFileSync(process.env.FAKE_STATE, 'utf8')) : { devices: [] })
} else if (verb === 'propose') {
  out({ proposalId: `p-${flag('--key')}`, state: 'sent', act: flag('--act'), addon: flag('--addon') })
} else if (verb === 'proposal') {
  out({ proposalId: args[3], state: process.env.FAKE_DECISION ?? 'kept', reason: 'fake' })
} else { out({ error: { code: 'INVALID_ARGUMENT' } }); process.exit(1) }
