// A note from Devin: what happened on Slack, as counts and a category, and optionally the new messages'
// text for Claude on this computer to summarize (src/summarize.js). Only the summary goes to the lamp.
export const KINDS = ['messages', 'mentions', 'news']
export const URGENCIES = ['low', 'normal', 'urgent']
const FIELDS = new Set(['v', 'id', 'kind', 'count', 'urgency', 'summary', 'messages', 'at', 'expiresAt'])
const MAX_HOLD_MS = 4 * 60 * 60 * 1000
// Harness carries a spoken line of at most 300 bytes (NOTE_MAX_BYTES); a summary is the whole line.
export const SUMMARY_MAX_BYTES = 300
export const MAX_MESSAGES = 50
export const MESSAGE_MAX_CHARS = 4000

// One plain line: no control characters, links, @handles or Slack markup (<@U…>, <#C…>, <!here>).
export function summaryWhy(value) {
  if (typeof value !== 'string' || !value.trim()) return 'summary'
  if (Buffer.byteLength(value.trim()) > SUMMARY_MAX_BYTES) return 'summary_too_long'
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value)) return 'summary_control'
  if (/[<>@]|:\/\/|\bwww\./i.test(value)) return 'summary_link_or_handle'
  return null
}

function messagesOk(value) {
  return Array.isArray(value) && value.length >= 1 && value.length <= MAX_MESSAGES
    && value.every((m) => typeof m === 'string' && m.trim() && m.length <= MESSAGE_MAX_CHARS)
}

export function parseNote(value, now = Date.now()) {
  const fail = (why) => ({ ok: false, why })
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('not_an_object')
  for (const key of Object.keys(value)) if (!FIELDS.has(key)) return fail(`unknown_field:${key}`)
  if (value.v !== 1) return fail('version')
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(value.id)) return fail('id')
  if (!KINDS.includes(value.kind)) return fail('kind')
  if (!Number.isInteger(value.count) || value.count < 1 || value.count > 999) return fail('count')
  if (!URGENCIES.includes(value.urgency)) return fail('urgency')
  if (value.summary !== undefined) { const why = summaryWhy(value.summary); if (why) return fail(why) }
  if (value.messages !== undefined && !messagesOk(value.messages)) return fail('messages')
  if (!Number.isInteger(value.at) || value.at > now + 60_000) return fail('at')
  const expiresAt = value.expiresAt ?? value.at + 60 * 60 * 1000
  if (!Number.isInteger(expiresAt) || expiresAt <= value.at || expiresAt - value.at > MAX_HOLD_MS) return fail('expiresAt')
  if (expiresAt <= now) return fail('expired')
  return { ok: true, note: { id: value.id, kind: value.kind, count: value.count, urgency: value.urgency,
    ...(value.summary !== undefined ? { summary: value.summary.trim() } : {}),
    ...(value.messages !== undefined ? { messages: value.messages } : {}), at: value.at, expiresAt } }
}

// The line the lamp may say: the summary when there is one, else the count built from the fields.
export function sayLine(note) {
  if (note.summary) return note.summary
  const what = note.kind === 'news' ? (note.count === 1 ? 'a news item' : `${note.count} news items`)
    : note.kind === 'mentions' ? (note.count === 1 ? 'a mention on Slack' : `${note.count} mentions on Slack`)
      : note.count === 1 ? 'a Slack message' : `${note.count} Slack messages`
  return `You have ${what}${note.urgency === 'urgent' ? ', one looks urgent' : ''}.`
}
