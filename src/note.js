// A note from Devin: what happened on Slack, as counts and a category, never its words.
export const KINDS = ['messages', 'mentions', 'news']
export const URGENCIES = ['low', 'normal', 'urgent']
const FIELDS = new Set(['v', 'id', 'kind', 'count', 'urgency', 'from', 'at', 'expiresAt'])
const MAX_HOLD_MS = 4 * 60 * 60 * 1000

export function parseNote(value, now = Date.now()) {
  const fail = (why) => ({ ok: false, why })
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('not_an_object')
  for (const key of Object.keys(value)) if (!FIELDS.has(key)) return fail(`unknown_field:${key}`)
  if (value.v !== 1) return fail('version')
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(value.id)) return fail('id')
  if (!KINDS.includes(value.kind)) return fail('kind')
  if (!Number.isInteger(value.count) || value.count < 1 || value.count > 999) return fail('count')
  if (!URGENCIES.includes(value.urgency)) return fail('urgency')
  if (value.from !== undefined && (typeof value.from !== 'string' || !/^[\p{L}\p{N} .'-]{1,32}$/u.test(value.from))) return fail('from')
  if (!Number.isInteger(value.at) || value.at > now + 60_000) return fail('at')
  const expiresAt = value.expiresAt ?? value.at + 60 * 60 * 1000
  if (!Number.isInteger(expiresAt) || expiresAt <= value.at || expiresAt - value.at > MAX_HOLD_MS) return fail('expiresAt')
  if (expiresAt <= now) return fail('expired')
  return { ok: true, note: { id: value.id, kind: value.kind, count: value.count, urgency: value.urgency, ...(value.from ? { from: value.from } : {}), at: value.at, expiresAt } }
}

// The one line the lamp may say, built here from fields only, so no Slack text can reach it.
export function sayLine(note) {
  const what = note.kind === 'news' ? (note.count === 1 ? 'a news item' : `${note.count} news items`)
    : note.kind === 'mentions' ? (note.count === 1 ? 'a mention on Slack' : `${note.count} mentions on Slack`)
      : note.count === 1 ? 'a Slack message' : `${note.count} Slack messages`
  const from = note.from ? ` from ${note.from}` : ''
  return `You have ${what}${from}${note.urgency === 'urgent' ? ', one looks urgent' : ''}.`
}
