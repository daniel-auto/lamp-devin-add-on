#!/usr/bin/env node
// lamp-devin-addon run | once | doctor
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createAddon } from '../src/daemon.js'
import { harnessLink } from '../src/lamp.js'
import { DEFAULTS } from '../src/policy.js'
import { createSummarizer, DEFAULT_MODEL } from '../src/summarize.js'

const env = process.env
const inbox = env.LAMP_ADDON_INBOX ?? join(homedir(), '.lamp-devin-addon', 'inbox')
const link = harnessLink({ bin: env.LAMP_ADDON_HARNESS ?? 'harness', device: env.LAMP_ADDON_DEVICE || undefined })
const config = { ...DEFAULTS, say: env.LAMP_ADDON_SAY === 'on' }
const log = (line) => console.log(`${new Date().toISOString()} ${line}`)
// Claude on this computer summarizes a note's messages when speech is on (LAMP_ADDON_SUMMARIZE=off to skip).
const summarize = config.say && env.LAMP_ADDON_SUMMARIZE !== 'off'
  ? createSummarizer({ model: env.LAMP_ADDON_MODEL || DEFAULT_MODEL, log }) : null
const addon = createAddon({ inbox, link, config, summarize, log })
const verb = process.argv[2] ?? 'run'

if (verb === 'doctor') {
  const state = await link.state().catch((e) => ({ error: e.message }))
  console.log(JSON.stringify({ inbox, say: config.say, summarize: summarize ? env.LAMP_ADDON_MODEL || DEFAULT_MODEL : 'off', lamp: state }, null, 2))
  process.exit(state && !state.error ? 0 : 1)
} else if (verb === 'once') {
  console.log(JSON.stringify(await addon.step()))
} else if (verb === 'run') {
  log(`watching ${inbox}; say ${config.say ? 'on' : 'off'}`)
  for (;;) {
    await addon.step().catch((e) => log(`step failed: ${e.message}`))
    await new Promise((r) => setTimeout(r, Number(env.LAMP_ADDON_POLL_MS ?? 3000)))
  }
} else {
  console.error('usage: lamp-devin-addon run | once | doctor'); process.exit(2)
}
