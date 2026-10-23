// When to ask the lamp, and for what. The lamp's judge still decides; these limits are ours, stricter.
import { sayLine } from './note.js'

export const DEFAULTS = {
  minGapMs: 5 * 60 * 1000, // one kept nudge every 5 min (lampOS's remote design)
  perHour: 6,
  dropBackoffMs: 5 * 60 * 1000, // after a drop, wait as the lamp's judge will
  holdsMs: 30_000,
  say: false, // spoken lines only when turned on: urgent notes, and normal ones with a summary
  whys: { messages: 'messages', mentions: 'messages', news: 'news' },
  light: { colour: 'warm', level: 2 },
}

// One device's state from `addon state`: {deviceId, online, topics: {topic: {value, at, receivedAt}}}.
const value = (state, topic) => state?.topics?.[topic]?.value ?? null

// Someone at the desk, and the voice resting: never in the middle of a conversation.
export function atDesk(state) {
  if (!state || state.online === false) return false
  return value(state, 'room/presence')?.someone === true && value(state, 'voice/state')?.state === 'resting'
}

// history: [{at, decision: 'kept'|'dropped'|'open'}]
export function decide(notes, state, history, now, config = DEFAULTS) {
  if (!notes.length) return { wait: 'no_notes' }
  if (!atDesk(state)) return { wait: 'not_at_desk' }
  if (history.some((h) => h.decision === 'open')) return { wait: 'open_proposal' }
  const kept = history.filter((h) => h.decision === 'kept')
  if (kept.some((h) => now - h.at < config.minGapMs)) return { wait: 'min_gap' }
  if (kept.filter((h) => now - h.at < 3_600_000).length >= config.perHour) return { wait: 'per_hour' }
  if (history.some((h) => h.decision === 'dropped' && now - h.at < config.dropBackoffMs)) return { wait: 'after_drop' }
  const order = { urgent: 0, normal: 1, low: 2 }
  const note = [...notes].sort((a, b) => order[a.urgency] - order[b.urgency] || a.at - b.at)[0]
  const why = config.whys[note.kind]
  const base = { noteId: note.id, why, holdsMs: config.holdsMs, sure: note.urgency === 'urgent' ? 0.8 : 0.5 }
  // Spoken: an urgent note, or a normal one with a summary. A low note only ever lights.
  const speaks = note.urgency === 'urgent' || (note.urgency === 'normal' && note.summary)
  if (config.say && speaks) return { propose: { ...base, act: 'say', note: sayLine(note) } }
  return { propose: { ...base, act: 'light', params: config.light } }
}
