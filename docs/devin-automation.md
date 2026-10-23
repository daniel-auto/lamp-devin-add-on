# The Devin side

A Devin Automation (scheduled, or on Slack events) watches the channels and DMs the person picks
and, when something deserves a nudge, writes one note in the [note format](note-format.md).

Draft prompt:

> Read new messages since your last run in: <channels/DMs>. Decide whether the person should be
> nudged at their desk. Count what is new, pick `kind` (`messages`, `mentions`, `news`) and `urgency`
> (`urgent` only for a direct ask with a deadline today, or from <allowed senders>), and put the new
> messages' text in `messages`, one string per message. Post exactly one JSON note, nothing else, to
> <#lamp-inbox>. Post nothing when there is nothing new.

Claude on the person's computer writes the spoken line from `messages`; Devin does not summarize.

Getting the note to this computer is the open piece: Devin runs in the cloud, so a small reader
on the computer copies notes from the private `#lamp-inbox` channel into the inbox folder. Until
that lands, drop notes into the folder by hand to test.
