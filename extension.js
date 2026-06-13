// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 ardenn.github.io

import GLib from "gi://GLib";
import Meta from "gi://Meta";

export default class MaximiseToWorkspaceExtension {
  enable() {
    this._moved = new Set(); // window IDs we relocated to a dedicated workspace
    this._windowSignals = new Map(); // MetaWindow → { fullscreen, unmanaged } signal IDs
    this._globalHandles = []; // { obj, id } pairs for global signal cleanup
    this._timeouts = new Set(); // pending GLib timeout IDs

    this._globalHandles.push({
      obj: global.window_manager,
      id: global.window_manager.connect("size-change", (_wm, actor, change) => {
        const win = actor.meta_window;
        if (change === Meta.SizeChange.MAXIMIZE)
          this._delayed(() => this._onBecameProminent(win));
        else if (change === Meta.SizeChange.UNMAXIMIZE)
          this._delayed(() => this._onNoLongerProminent(win));
      }),
    });

    this._globalHandles.push({
      obj: global.display,
      id: global.display.connect("window-created", (_display, win) => {
        this._trackWindow(win);
      }),
    });

    global.get_window_actors().forEach((actor) => {
      if (actor.meta_window) this._trackWindow(actor.meta_window);
    });
  }

  disable() {
    this._timeouts.forEach((id) => GLib.Source.remove(id));
    this._timeouts.clear();

    this._globalHandles.splice(0).forEach(({ obj, id }) => obj.disconnect(id));

    for (const [win, signals] of this._windowSignals) {
      win.disconnect(signals.fullscreen);
      win.disconnect(signals.unmanaged);
    }
    this._windowSignals.clear();
    this._moved.clear();
  }

  // ── Window tracking ──────────────────────────────────────────────────────

  _trackWindow(win) {
    if (this._windowSignals.has(win) || !this._isEligible(win)) return;

    const fsId = win.connect("notify::fullscreen", () => {
      if (win.is_fullscreen())
        this._delayed(() => this._onBecameProminent(win));
      else this._delayed(() => this._onNoLongerProminent(win));
    });

    const unmanagedId = win.connect("unmanaged", () => {
      const wsIndex = win.get_workspace()?.index() ?? 0;
      this._untrackWindow(win);
      if (wsIndex > 0)
        this._delayed(() => this._cleanupWorkspace(wsIndex), 300);
    });

    this._windowSignals.set(win, { fullscreen: fsId, unmanaged: unmanagedId });

    // Handle windows that are already prominent when the extension loads
    if (this._isProminent(win))
      this._delayed(() => this._onBecameProminent(win));
  }

  _untrackWindow(win) {
    const signals = this._windowSignals.get(win);
    if (!signals) return;
    win.disconnect(signals.fullscreen);
    win.disconnect(signals.unmanaged);
    this._windowSignals.delete(win);
    this._moved.delete(win.get_id());
  }

  // ── State queries ─────────────────────────────────────────────────────────

  _isEligible(win) {
    return (
      win.window_type === Meta.WindowType.NORMAL && !win.is_on_all_workspaces()
    );
  }

  // A window is "prominent" when it occupies the full screen - either via
  // GNOME's maximise or via a true fullscreen mode (e.g. F11, video players).
  _isProminent(win) {
    return (
      (win.maximized_horizontally && win.maximized_vertically) ||
      win.is_fullscreen()
    );
  }

  // ── Core logic ────────────────────────────────────────────────────────────

  _onBecameProminent(win) {
    if (!this._isEligible(win) || this._moved.has(win.get_id())) return;

    const currentWs = win.get_workspace();
    if (!currentWs) return;

    // Always mark as moved so _onNoLongerProminent will restore it to ws 0
    this._moved.add(win.get_id());

    const others = currentWs
      .list_windows()
      .filter((w) => w !== win && !w.is_on_all_workspaces());
    if (others.length === 0) return; // Already alone - stay put, but still tracked

    const wm = global.workspace_manager;
    const target = this._findOrCreateEmptyWorkspace(wm);
    win.change_workspace_by_index(target, false);
    wm.get_workspace_by_index(target)?.activate_with_focus(
      win,
      global.get_current_time(),
    );
  }

  _onNoLongerProminent(win) {
    // Guard: only act on windows we moved, and only once fully un-prominent
    // (a window may exit fullscreen while still maximised - don't restore yet)
    if (!this._moved.has(win.get_id()) || this._isProminent(win)) return;

    const previousWsIndex = win.get_workspace()?.index() ?? 0;
    this._moved.delete(win.get_id());

    const wm = global.workspace_manager;
    win.change_workspace_by_index(0, false);
    wm.get_workspace_by_index(0)?.activate_with_focus(
      win,
      global.get_current_time(),
    );

    if (previousWsIndex > 0)
      this._delayed(() => this._cleanupWorkspace(previousWsIndex), 300);
  }

  // ── Workspace helpers ─────────────────────────────────────────────────────

  _findOrCreateEmptyWorkspace(wm) {
    const n = wm.get_n_workspaces();
    for (let i = 1; i < n; i++) {
      const ws = wm.get_workspace_by_index(i);
      if (
        ws &&
        ws.list_windows().filter((w) => !w.is_on_all_workspaces()).length === 0
      )
        return i;
    }
    wm.append_new_workspace(false, global.get_current_time());
    return wm.get_n_workspaces() - 1;
  }

  _cleanupWorkspace(index) {
    const wm = global.workspace_manager;
    if (index <= 0 || index >= wm.get_n_workspaces()) return;
    const ws = wm.get_workspace_by_index(index);
    if (!ws || ws.active) return;
    if (ws.list_windows().filter((w) => !w.is_on_all_workspaces()).length === 0)
      wm.remove_workspace(ws, global.get_current_time());
  }

  _delayed(fn, ms = 100) {
    const id = GLib.timeout_add(GLib.PRIORITY_LOW, ms, () => {
      this._timeouts.delete(id);
      fn();
      return GLib.SOURCE_REMOVE;
    });
    this._timeouts.add(id);
  }
}
