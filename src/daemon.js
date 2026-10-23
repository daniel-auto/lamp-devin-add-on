// One step of the loop: read notes, read the lamp, maybe propose, follow up on the answer.
import { randomUUID } from 'node:crypto'
import { readInbox, finish } from './inbox.js'
import { decide, DEFAULTS } from './policy.js'

export function createAddon({ inbox, link, config = DEFAULTS, now = () => Date.now(), log = () => {} }) {
  const history = [] // {at, decision, proposalId, note}
  const unknownKeys = new Map() // note id -> the key of a propose Harness could not confirm, sent again on the retry
  let lastWait = null

  async function step() {
    const t = now()
    const open = history.find((h) => h.decision === 'open')
    if (open) {
      const answer = await link.proposal(open.proposalId).catch(() => null)
      const state = answer?.state
      if (state === 'kept' || state === 'dropped' || state === 'expired' || answer?.error || t - open.at > 60_000) {
        open.decision = state === 'kept' ? 'kept' : 'dropped'
        log(`proposal ${open.proposalId} ${state ?? 'lost'}${answer?.reason ? `: ${answer.reason}` : ''}`)
        if (open.decision === 'kept') await finish(inbox, open.note)
      }
      return { wait: 'open_proposal' }
    }
    while (history.length && t - history[0].at > 3_600_000) history.shift()
    const notes = await readInbox(inbox, t, log)
    for (const id of unknownKeys.keys()) if (!notes.some((n) => n.id === id)) unknownKeys.delete(id)
    const state = await link.state().catch(() => null)
    const choice = decide(notes, state, history, t, config)
    if (choice.wait) {
      if (choice.wait !== lastWait) log(`waiting: ${choice.wait}`)
      lastWait = choice.wait
      return choice
    }
    lastWait = null
    const note = notes.find((n) => n.id === choice.propose.noteId)
    const key = unknownKeys.get(note.id) ?? randomUUID().replace(/-/g, '')
    const answer = await link.propose({ ...choice.propose, key }).catch((e) => ({ error: { message: e.message } }))
    // OUTCOME_UNKNOWN: the lamp may have it. The same key makes the retry that proposal again, not a second nudge.
    if (answer?.error?.code === 'OUTCOME_UNKNOWN') unknownKeys.set(note.id, key)
    else unknownKeys.delete(note.id)
    if (!answer?.proposalId) {
      log(`propose failed: ${answer?.error?.code ?? answer?.error?.message ?? 'no answer'}`)
      history.push({ at: t, decision: 'dropped', note })
      return { failed: answer }
    }
    log(`proposed ${choice.propose.act} for note ${note.id} (${answer.proposalId})`)
    history.push({ at: t, decision: 'open', proposalId: answer.proposalId, note })
    return { proposed: answer.proposalId, act: choice.propose.act }
  }
  return { step, history }
}
