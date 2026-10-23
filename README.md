# lamp-devin-add-on

Devin watches Slack; the lamp notices you when you're at your desk.

A computer-side add-on for an Autonomous lamp. Devin turns Slack activity into small
[notes](docs/note-format.md) with counts and categories, never message text. This service, on the
computer paired with the lamp, waits until someone is at the desk and the lamp's voice is resting,
then *proposes* a nudge. The lamp's judge decides whether it happens.

```
Devin Automation (Slack) -> note -> inbox folder -> this add-on -> Harness -> lamp's judge -> light / say
```

## What it does

- Light first: a short warm glow.
- A spoken line only with `LAMP_ADDON_SAY=on`, for `urgent` notes and `normal` ones with a summary. When
  a note carries its messages, Claude on this computer summarizes them through the
  [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) (`src/summarize.js`) into one
  line of at most 300 bytes; only that line goes to the lamp. Without messages, the line is the count.
- Only when the lamp says someone is at the desk (`room/presence`) and its voice is resting. A lamp
  that doesn't publish `room/presence` (lamp-eyes without `LAMP_PRESENCE=on`) gets no nudges: an
  absent topic is unknown, never guessed from another one such as `room/state`.
- Its own limits, stricter than the lamp's: one undecided proposal at a time, a kept nudge at most
  every 5 minutes and 6 an hour, 5 minutes' backoff after a drop.
- A kept note is filed in `inbox/done/`; a dropped one is tried again later until it expires.

## Status

Not usable on a lamp yet. It depends on lampOS work that is designed but not built:

- lampOS: a remote add-on service on the lamp, and the judge accepting a remote writer
  (lampOS `docs/addons.md`, "Remote add-ons"; planned after 1.0, off by default).
- Harness: the add-on route to the lamp's own Harness daemon (openharness#1654).
- The reasons a remote proposal may give (`why`): this add-on sends `messages` or `news`, which
  lampOS does not accept yet.

All lamp traffic is in `src/lamp.js`, which today calls
`harness autonomous-device addon state|propose|proposal` (openharness#1485). When the route above
is settled, only that file changes.

## Run

Node 20 or newer (the Harness CLI brings it). One optional dependency, the Claude Agent SDK, for
summaries (`npm install`); without it the add-on runs and says counts only. The SDK uses this
computer's Claude credentials. For anything shipped to other people, use an `ANTHROPIC_API_KEY`:
Anthropic does not allow claude.ai login in third-party products built on the Agent SDK.

```sh
npm test                                   # against a fake Harness CLI
node bin/lamp-devin-addon.js doctor        # what Harness says about the lamp
node bin/lamp-devin-addon.js once          # one step
install/macos/install.sh                   # launchd agent; LAMP_ADDON_SAY=on to allow speech
install/macos/uninstall.sh
```

| variable | default |
|---|---|
| `LAMP_ADDON_INBOX` | `~/.lamp-devin-addon/inbox` |
| `LAMP_ADDON_HARNESS` | `harness` |
| `LAMP_ADDON_DEVICE` | the one connected device |
| `LAMP_ADDON_SAY` | `off` |
| `LAMP_ADDON_POLL_MS` | `3000` |
| `LAMP_ADDON_SUMMARIZE` | `on` when say is on; `off` to skip Claude |
| `LAMP_ADDON_MODEL` | `claude-opus-5-5` |

The Devin side is in [docs/devin-automation.md](docs/devin-automation.md).
