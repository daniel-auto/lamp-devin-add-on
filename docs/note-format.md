# Note format

Devin writes one JSON file per note into the inbox (`~/.lamp-devin-addon/inbox/<id>.json`).
A note says *that* something happened on Slack, never *what* was said.

```json
{"v": 1, "id": "slack-20261023-0912", "kind": "messages", "count": 3, "urgency": "urgent", "from": "Lead", "at": 1792745159000, "expiresAt": 1792748759000}
```

| field | rule |
|---|---|
| `v` | `1` |
| `id` | 1–64 of `A-Z a-z 0-9 _ . : -`; a repeat id is the same note |
| `kind` | `messages`, `mentions` or `news` |
| `count` | 1–999 |
| `urgency` | `low`, `normal` or `urgent` |
| `from` | optional label, 1–32 letters, digits, spaces, `.'-` (a role such as "Lead", not a handle) |
| `at` | when Devin saw it, ms since the epoch |
| `expiresAt` | optional, at most 4 h after `at`; default 1 h |

Write each note atomically: write it under a name that does not end in `.json`, then rename it to
`<id>.json`. A `.json` file that does not parse is left alone for 10 seconds, in case it is still
being written, and then deleted.

Any other field, a file over 2 KB, or a broken rule: the note is deleted unread.
The lamp's spoken line, when there is one, is built from these fields by the add-on
(`src/note.js`), so no Slack text reaches the lamp.
