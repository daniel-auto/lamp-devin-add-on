#!/bin/sh
# Installs the add-on as a launchd agent for this user: starts at login, restarts if it stops.
set -eu
here=$(cd "$(dirname "$0")/../.." && pwd)
node=$(command -v node) || { echo "node (>= 20) is needed: Harness CLI brings it" >&2; exit 1; }
harness=$(command -v harness) || { echo "harness CLI not found: install Harness first" >&2; exit 1; }
home_dir="$HOME/.lamp-devin-addon"
mkdir -p "$home_dir/inbox/done"
label=ai.autonomous.lamp-devin-addon
plist="$HOME/Library/LaunchAgents/$label.plist"
say=${LAMP_ADDON_SAY:-off}
sed -e "s#@NODE@#$node#g" -e "s#@APP@#$here/bin/lamp-devin-addon.js#g" -e "s#@HARNESS@#$harness#g" \
    -e "s#@HOME_DIR@#$home_dir#g" -e "s#@SAY@#$say#g" -e "s#@DEVICE@#${LAMP_ADDON_DEVICE:-}#g" \
    "$here/install/macos/$label.plist" > "$plist"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "installed: $label (say $say). Logs: $home_dir/addon.log. Notes go in $home_dir/inbox"
