// Notes arrive as JSON files in a folder (the Slack-channel reader writes them there too).
import { readdir, readFile, rename, mkdir, unlink, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseNote } from './note.js'

const MAX_FILE_BYTES = 256 * 1024 // room for a note's messages (50 of at most 4,000 characters)
const WRITING_MS = 10_000 // a file this new that is not JSON yet may still be being written: left for the next read
const DONE_KEEP_MS = 24 * 60 * 60 * 1000 // a handled note's id is remembered this long, past any note's expiry

export async function readInbox(dir, now = Date.now(), log = () => {}) {
  const doneDir = join(dir, 'done')
  await mkdir(doneDir, { recursive: true })
  const done = new Set()
  for (const name of await readdir(doneDir)) {
    const modified = await stat(join(doneDir, name)).then((s) => s.mtimeMs, () => 0)
    if (Date.now() - modified > DONE_KEEP_MS) await unlink(join(doneDir, name)).catch(() => {})
    else if (name.endsWith('.json')) done.add(name.slice(0, -'.json'.length))
  }
  const notes = []
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const path = join(dir, name)
    let parsed
    try {
      const bytes = await readFile(path)
      parsed = bytes.length > MAX_FILE_BYTES ? { ok: false, why: 'too_big' } : parseNote(JSON.parse(bytes.toString('utf8')), now)
    } catch {
      const modified = await stat(path).then((s) => s.mtimeMs, () => 0)
      if (Date.now() - modified < WRITING_MS) continue
      parsed = { ok: false, why: 'not_json' }
    }
    if (parsed.ok && done.has(parsed.note.id)) parsed = { ok: false, why: 'repeat' }
    if (parsed.ok) notes.push({ ...parsed.note, file: name })
    else { log(`dropped note ${name}: ${parsed.why}`); await unlink(path).catch(() => {}) }
  }
  return notes
}

// A handled note is filed without its messages: done/ keeps the id for repeats, not the Slack text.
export async function finish(dir, note) {
  const from = join(dir, note.file), to = join(dir, 'done', `${note.id}.json`)
  try {
    const { messages: _text, ...kept } = JSON.parse(await readFile(from, 'utf8'))
    await writeFile(`${to}.tmp`, JSON.stringify(kept))
    await rename(`${to}.tmp`, to)
    await unlink(from)
  } catch {
    await unlink(from).catch(() => {})
    await writeFile(to, JSON.stringify({ v: 1, id: note.id })).catch(() => {})
  }
}
