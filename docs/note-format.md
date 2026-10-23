# Note format

Devin writes one JSON file per note into the inbox (`~/.lamp-devin-addon/inbox/<id>.json`).
A note says *that* something happened on Slack. It may also carry the new messages' text, which
Claude on this computer summarizes into the one line the lamp says ([summarize.js](../src/summarize.js));
the messages themselves never go to the lamp.

```json
{"v": 1, "id": "slack-20261023-0912", "kind": "messages", "count": 3, "urgency": "urgent", "messages": ["Can you send the deploy notes before 3pm?", "CI is green again."], "at": 1792745159000, "expiresAt": 1792748759000}
```

| field | rule |
|---|---|
| `v` | `1` |
| `id` | 1–64 of `A-Z a-z 0-9 _ . : -`; a repeat id is the same note |
| `kind` | `messages`, `mentions` or `news` |
| `count` | 1–999 |
| `urgency` | `low`, `normal` or `urgent` |
| `messages` | optional, 1–50 strings of at most 4,000 characters: the new messages, for Claude here to summarize |
| `summary` | optional, a line already written; at most 300 bytes, no line breaks, links, `@` handles or `<…>` Slack markup |
| `at` | when Devin saw it, ms since the epoch |
| `expiresAt` | optional, at most 4 h after `at`; default 1 h |

Write each note atomically: write it under a name that does not end in `.json`, then rename it to
`<id>.json`. A `.json` file that does not parse is left alone for 10 seconds, in case it is still
being written, and then deleted.

A note whose `id` was already handled in the last 24 h is deleted unread, so a re-sent note nudges once.
A handled note is filed in `done/` without its `messages`; only its id and counts are kept.

Any other field, a file over 256 KiB, or a broken rule: the note is deleted unread.
The lamp's spoken line, when there is one, is the summary (Claude's, or the note's own), held to the same
rules as `summary` and Harness's 300 bytes; with no summary it is the count built from the fields, "You have
3 Slack messages, one looks urgent." With `LAMP_ADDON_SAY=on`, an `urgent` note, or a `normal` one with a
summary, is spoken; a `low` one only lights. Claude is asked once per note, only when that note is about to
be proposed and could be spoken. A line that breaks a rule is not sent; the count is said instead.
