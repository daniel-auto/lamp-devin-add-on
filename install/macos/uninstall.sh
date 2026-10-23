#!/bin/sh
set -eu
label=ai.autonomous.lamp-devin-addon
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$label.plist"
echo "removed $label (notes and logs kept in ~/.lamp-devin-addon)"
