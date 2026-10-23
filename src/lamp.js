// The lamp link. Today: the Harness CLI's add-on commands on this computer
// (openharness#1485). The final lampOS route (openharness#1654) changes only this file.
import { execFile } from 'node:child_process'

export const ADDON = 'devin-slack'

export function harnessLink({ bin = 'harness', device, run = execFileJson } = {}) {
  const dev = device ? ['--device', device] : []
  return {
    async state() {
      const answer = await run(bin, ['autonomous-device', 'addon', 'state', ...dev, '--json'])
      const devices = answer?.devices ?? []
      const one = device ? devices.find((d) => d.deviceId === device) : devices.length === 1 ? devices[0] : null
      return one ?? null
    },
    async propose(p) {
      const args = ['autonomous-device', 'addon', 'propose', '--addon', ADDON, '--act', p.act,
        '--holds-ms', String(p.holdsMs), '--key', p.key, ...dev, '--json']
      if (p.why) args.push('--why', p.why)
      if (p.sure !== undefined) args.push('--sure', String(p.sure))
      if (p.params) args.push('--params', JSON.stringify(p.params))
      if (p.note) args.push('--note', p.note)
      return run(bin, args)
    },
    async proposal(id) {
      return run(bin, ['autonomous-device', 'addon', 'proposal', id, '--json'])
    },
  }
}

// The CLI prints one JSON answer, also on failure (exit 1).
export function execFileJson(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 20_000, maxBuffer: 1 << 20 }, (error, stdout) => {
      try { return resolve(JSON.parse(stdout)) } catch {}
      reject(error ?? new Error('harness printed no JSON'))
    })
  })
}
