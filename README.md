# Maximise to Workspace

A GNOME Shell extension that moves maximised or fullscreen windows to a dedicated empty workspace, keeping your main workspace clean and uncluttered.

## How it works

- **Maximise or go fullscreen** - the window is moved to the first available empty workspace (or a newly created one), and focus follows it there.
- **Unmaximise or exit fullscreen** - the window is returned to workspace 0 (the main workspace, displayed as "Workspace 1" in the GNOME UI), and the now-empty dedicated workspace is removed.
- **Already alone** - if a window is the only one on its workspace when maximised, it stays put but is still tracked so it returns to the main workspace on unmaximise.

Workspace 0 is the permanent home for all non-prominent windows. The extension enforces this automatically.

## Features

- Triggers on both GNOME maximise (`Super+↑`) and true fullscreen (e.g. `F11`, video players)
- Works across all monitors - no primary-monitor restriction
- Cleans up empty workspaces when windows leave them
- No settings or configuration required
- Handles windows that are already maximised or fullscreen when the extension is enabled

## Requirements

- GNOME Shell 45 or later

## Installation

### From GNOME Extensions

Visit [extensions.gnome.org](https://extensions.gnome.org) and search for **Maximise to Workspace**. *(Coming soon.)*

### Manual

```bash
git clone https://github.com/ardenn/maximise-to-workspace.git
ln -s "$PWD/maximise-to-workspace" \
  ~/.local/share/gnome-shell/extensions/maximise-to-workspace@ardenn.github.io
```

Log out and back in (Wayland), or press `Alt+F2`, type `r`, and press `Enter` (X11). Then enable the extension:

```bash
gnome-extensions enable maximise-to-workspace@ardenn.github.io
```

Or toggle it via the **Extensions** app.

## Uninstallation

```bash
gnome-extensions disable maximise-to-workspace@ardenn.github.io
rm ~/.local/share/gnome-shell/extensions/maximise-to-workspace@ardenn.github.io
```

## Troubleshooting

Check the GNOME Shell log for any errors:

```bash
journalctl -f /usr/bin/gnome-shell
```

## Acknowledgements

Inspired by:

- [gnome-shell-extension-maximize-to-workspace](https://github.com/rliang/gnome-shell-extension-maximize-to-workspace) by rliang - maximise trigger and restore pattern
- [kiwi-kemma](https://github.com/kem-a/kiwi-kemma/blob/main/apps/moveFullscreenWindow.js) by kem-a - modern ES-module API and workspace lifecycle management
