import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readInbox } from '../src/inbox.js'

test('the 2 KB limit counts bytes, not characters', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inbox-'))
  writeFileSync(join(dir, 'big.json'), JSON.stringify({ v: 1, pad: 'é'.repeat(1100) })) // ~1,100 characters, ~2,200 bytes
  const why = []
  assert.deepEqual(await readInbox(dir, Date.now(), (l) => why.push(l)), [])
  assert.match(why.join('\n'), /too_big/)
})
