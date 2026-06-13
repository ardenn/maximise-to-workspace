# Contributing

## How it works

The extension enforces one rule: **workspace 0 is the permanent home for all non-prominent windows** (GNOME displays this as "Workspace 1" in its UI). A window is *prominent* when it is fully maximised (both axes) or fullscreen. When a window becomes prominent it is moved to the first available empty workspace so it has the screen to itself; when it stops being prominent it is always returned to workspace 0. Empty workspaces created for prominent windows are removed once vacated.

---

## Architecture

The entire extension lives in a single class, `MaximiseToWorkspaceExtension`, exported from `extension.js` using the GNOME Shell 45+ ES-module format. There are no dependencies beyond `GLib` and `Meta` from the GNOME introspection bindings.

### State

| Field | Type | Purpose |
|---|---|---|
| `_moved` | `Set<number>` | IDs of windows currently on a dedicated workspace managed by this extension |
| `_windowSignals` | `Map<MetaWindow, {fullscreen, unmanaged}>` | Per-window signal connection IDs, used to disconnect cleanly on `disable()` |
| `_globalHandles` | `Array<{obj, id}>` | Global signal connection IDs (one for `size-change`, one for `window-created`) |
| `_timeouts` | `Set<number>` | Pending `GLib.timeout_add` source IDs, cancelled on `disable()` to prevent stale callbacks |

### Signal flow

```
global.window_manager  'size-change'
  Meta.SizeChange.MAXIMIZE   ──► _onBecameProminent
  Meta.SizeChange.UNMAXIMIZE ──► _onNoLongerProminent

global.display  'window-created'
  ──► _trackWindow
        per-window 'notify::fullscreen'
          is_fullscreen() == true  ──► _onBecameProminent
          is_fullscreen() == false ──► _onNoLongerProminent
        per-window 'unmanaged'
          ──► _untrackWindow
          ──► _cleanupWorkspace  (if window was on ws > 0)
```

`enable()` also calls `_trackWindow` for all windows already open, which bootstraps any that are already prominent.

All callbacks go through `_delayed()` (100 ms default). This lets Mutter finish updating window state before we act on it.

---

## Method reference

| Method | Description |
|---|---|
| `enable()` | Initialises state, connects the two global signals, bootstraps existing windows. |
| `disable()` | Cancels all pending timeouts, disconnects every signal (global and per-window), clears state. |
| `_trackWindow(win)` | Connects `notify::fullscreen` and `unmanaged` signals to a window; skips ineligible windows and already-tracked windows. |
| `_untrackWindow(win)` | Disconnects a window's signals and removes it from `_moved`. |
| `_isEligible(win)` | Returns `true` for `NORMAL` windows not pinned to all workspaces. All other window types (panels, dialogs, etc.) are ignored. |
| `_isProminent(win)` | Returns `true` if `maximized_horizontally && maximized_vertically` OR `is_fullscreen()`. |
| `_onBecameProminent(win)` | If the window shares its workspace with others, finds/creates an empty workspace and moves the window there. Marks it in `_moved` either way. |
| `_onNoLongerProminent(win)` | Moves the window back to workspace 0 and activates it. Guards against acting while the window is still partially prominent (e.g. exited fullscreen but still maximised). |
| `_findOrCreateEmptyWorkspace(wm)` | Scans workspaces from index 1 upward for one with no non-sticky windows; appends a new workspace if none is found. |
| `_cleanupWorkspace(index)` | Removes a workspace if it is empty, not workspace 0, and not currently active. |
| `_delayed(fn, ms = 100)` | Wraps `GLib.timeout_add`; stores the source ID in `_timeouts` so `disable()` can cancel it. |

---

## Key GNOME Shell APIs

| API | Notes |
|---|---|
| `global.window_manager` (`Shell.WM`) | Emits `size-change(actor, Meta.SizeChange, ...)` for maximise/unmaximise events |
| `global.display` (`Meta.Display`) | Emits `window-created(win)` for every new window |
| `global.workspace_manager` (`Meta.WorkspaceManager`) | `get_workspace_by_index`, `append_new_workspace`, `remove_workspace` |
| `MetaWindow.maximized_horizontally` / `maximized_vertically` | GObject boolean properties. **Note:** `get_maximized()` was removed in Mutter 50 - do not use it. |
| `MetaWorkspace.activate_with_focus(win, timestamp)` | Switches to the workspace and focuses the given window in one call |
| `GLib.timeout_add(priority, ms, fn)` | Returns a source ID; call `GLib.Source.remove(id)` to cancel |

---

## Development setup

```bash
git clone https://github.com/ardenn/maximise-to-workspace.git
ln -sf "$PWD/maximise-to-workspace" \
  ~/.local/share/gnome-shell/extensions/maximise-to-workspace@ardenn.github.io
gnome-extensions enable maximise-to-workspace@ardenn.github.io
```

After editing `extension.js`, reload by toggling the extension off and on:

```bash
gnome-extensions disable maximise-to-workspace@ardenn.github.io
gnome-extensions enable maximise-to-workspace@ardenn.github.io
```

Watch for runtime errors:

```bash
journalctl -f /usr/bin/gnome-shell
```

---

## Testing checklist

- [ ] Two windows on workspace 0 → maximise one → it moves to workspace 1, focus follows
- [ ] Unmaximise → window returns to workspace 0, workspace 1 is removed
- [ ] F11 fullscreen on a shared workspace → same move behaviour
- [ ] Exit fullscreen while still maximised → no restore yet; unmaximise → restores to workspace 0
- [ ] Single window on workspace 0, maximise → stays (nothing to share with); unmaximise → no move
- [ ] Second monitor: maximise a window → moves to a dedicated workspace the same as on the primary monitor
- [ ] Close a maximised window → vacated workspace is cleaned up
