#!/bin/sh
# Installs the add-on as a launchd agent for this user: starts at login, restarts if it stops.
set -eu
here=$(cd "$(dirname "$0")/../.." && pwd)
# Node on PATH, else the one Harness installed for itself (its shim calls it by absolute path).
node=$(command -v node 2>/dev/null || true)
runtime="$HOME/.harness/runtime"
if [ -z "$node" ] && [ -r "$runtime/current-node" ]; then
  managed=$(cat "$runtime/current-node")
  case "$managed" in "$runtime"/*) [ -x "$managed" ] && node=$managed ;; esac
fi
[ -n "$node" ] && "$node" -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)' \
  || { echo "node (>= 20) is needed: install Harness, which brings one" >&2; exit 1; }
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
