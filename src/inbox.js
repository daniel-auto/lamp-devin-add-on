// Notes arrive as small JSON files in a folder (the Slack-channel reader writes them there too).
import { readdir, readFile, rename, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { parseNote } from './note.js'

const MAX_FILE_BYTES = 2048

export async function readInbox(dir, now = Date.now(), log = () => {}) {
  await mkdir(join(dir, 'done'), { recursive: true })
  const notes = []
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const path = join(dir, name)
    let parsed
    try {
      const text = await readFile(path, 'utf8')
      parsed = text.length > MAX_FILE_BYTES ? { ok: false, why: 'too_big' } : parseNote(JSON.parse(text), now)
    } catch { parsed = { ok: false, why: 'not_json' } }
    if (parsed.ok) notes.push({ ...parsed.note, file: name })
    else { log(`dropped note ${name}: ${parsed.why}`); await unlink(path).catch(() => {}) }
  }
  return notes
}

export async function finish(dir, note) {
  await rename(join(dir, note.file), join(dir, 'done', note.file)).catch(() => {})
}
