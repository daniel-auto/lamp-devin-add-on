// Notes arrive as small JSON files in a folder (the Slack-channel reader writes them there too).
import { readdir, readFile, rename, mkdir, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { parseNote } from './note.js'

const MAX_FILE_BYTES = 2048
const WRITING_MS = 10_000 // a file this new that is not JSON yet may still be being written: left for the next read

export async function readInbox(dir, now = Date.now(), log = () => {}) {
  await mkdir(join(dir, 'done'), { recursive: true })
  const notes = []
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const path = join(dir, name)
    let parsed
    try {
      const text = await readFile(path, 'utf8')
      parsed = text.length > MAX_FILE_BYTES ? { ok: false, why: 'too_big' } : parseNote(JSON.parse(text), now)
    } catch {
      const modified = await stat(path).then((s) => s.mtimeMs, () => 0)
      if (Date.now() - modified < WRITING_MS) continue
      parsed = { ok: false, why: 'not_json' }
    }
    if (parsed.ok) notes.push({ ...parsed.note, file: name })
    else { log(`dropped note ${name}: ${parsed.why}`); await unlink(path).catch(() => {}) }
  }
  return notes
}

export async function finish(dir, note) {
  await rename(join(dir, note.file), join(dir, 'done', note.file)).catch(() => {})
}
