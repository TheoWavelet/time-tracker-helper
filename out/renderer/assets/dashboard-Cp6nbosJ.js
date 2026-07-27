import { r as reactExports, u as useToasts, j as jsxRuntimeExports, T as ToastStack, C as ChartIcon, G as GearIcon, a as TrashIcon, H as HistoryTimerRow, c as client, R as React } from "./TimerRows-rZusqEBO.js";
function startOfDay(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(timestamp) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}
function historyTimestamp(timer) {
  return timer.stoppedAt ?? timer.updatedAt;
}
function groupHistory(timers, now) {
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const groups = { today: [], thisWeek: [], older: [] };
  for (const timer of timers) {
    const ts = historyTimestamp(timer);
    if (ts >= todayStart) groups.today.push(timer);
    else if (ts >= weekStart) groups.thisWeek.push(timer);
    else groups.older.push(timer);
  }
  return groups;
}
const PAIRING_POLL_INTERVAL_MS = 1500;
const UNDO_DELETE_WINDOW_MS = 5e3;
const CHROME_EXTENSIONS_URL = "chrome://extensions/";
const EXTENSION_DOWNLOAD_URL = "https://drive.google.com/drive/u/1/folders/1Jg0-a5bE0InWvpB-xyORBsQWbTrqhASP";
function App() {
  const [snapshot, setSnapshot] = reactExports.useState(null);
  const [settings, setSettings] = reactExports.useState(null);
  const [pairingInfo, setPairingInfo] = reactExports.useState(null);
  const [domainFilterInput, setDomainFilterInput] = reactExports.useState("");
  const [clockworkStatus, setClockworkStatus] = reactExports.useState(null);
  const [clockworkTokenInput, setClockworkTokenInput] = reactExports.useState("");
  const [pendingDeleteIds, setPendingDeleteIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [settingsOpen, setSettingsOpen] = reactExports.useState(false);
  const pendingDeleteTimers = reactExports.useRef(/* @__PURE__ */ new Map());
  const settingsRef = reactExports.useRef(null);
  const { toasts, pushToast, dismissToast } = useToasts();
  reactExports.useEffect(() => {
    return () => {
      for (const timer of pendingDeleteTimers.current.values()) window.clearTimeout(timer);
    };
  }, []);
  reactExports.useEffect(() => {
    if (!settingsOpen) return;
    function handleOutsideMouseDown(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, [settingsOpen]);
  reactExports.useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot);
    window.api.settings.get().then((s) => {
      setSettings(s);
      setDomainFilterInput(s.browserDomainFilter);
    });
    const offTimers = window.api.timers.onChanged(setSnapshot);
    const offSettings = window.api.settings.onChanged((s) => {
      setSettings(s);
      setDomainFilterInput(s.browserDomainFilter);
    });
    return () => {
      offTimers();
      offSettings();
    };
  }, []);
  reactExports.useEffect(() => {
    window.api.browser.getPairingInfo().then(setPairingInfo);
    const interval = window.setInterval(() => {
      window.api.browser.getPairingInfo().then(setPairingInfo);
    }, PAIRING_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);
  reactExports.useEffect(() => {
    window.api.clockwork.getStatus().then(setClockworkStatus);
  }, []);
  function handleCopyPairingToken() {
    if (!pairingInfo) return;
    navigator.clipboard.writeText(pairingInfo.token);
    pushToast("Copied pairing token");
  }
  function handleOpenChromeExtensions() {
    window.api.shell.openExternal(CHROME_EXTENSIONS_URL).catch(() => {
    });
  }
  function handleCopyChromeExtensionsLink() {
    navigator.clipboard.writeText(CHROME_EXTENSIONS_URL);
    pushToast("Copied chrome://extensions/ link");
  }
  function handleDownloadExtension() {
    window.api.shell.openExternal(EXTENSION_DOWNLOAD_URL);
  }
  async function handleSaveClockworkToken() {
    if (!clockworkTokenInput.trim()) return;
    const updated = await window.api.clockwork.setApiToken(clockworkTokenInput);
    setClockworkStatus(updated);
    setClockworkTokenInput("");
    pushToast("Saved Clockwork API token");
  }
  async function handleClearClockworkToken() {
    const updated = await window.api.clockwork.setApiToken("");
    setClockworkStatus(updated);
    pushToast("Cleared Clockwork API token");
  }
  async function handleToggleClockworkSync() {
    const updated = await window.api.settings.setClockworkSyncEnabled(!settings?.clockworkSyncEnabled);
    setSettings(updated);
  }
  async function commitDomainFilter() {
    const updated = await window.api.settings.setBrowserDomainFilter(domainFilterInput);
    setSettings(updated);
    setDomainFilterInput(updated.browserDomainFilter);
  }
  async function handleDockSideChange(dockSide) {
    const updated = await window.api.settings.setDockSide(dockSide);
    setSettings(updated);
  }
  async function handleToggleHighlightPaused() {
    const updated = await window.api.settings.setHighlightPausedTimers(!settings?.highlightPausedTimers);
    setSettings(updated);
  }
  if (!snapshot) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "app-loading", children: "Loading…" });
  }
  function scheduleDelete(ids) {
    setPendingDeleteIds((previous) => /* @__PURE__ */ new Set([...previous, ...ids]));
    for (const id of ids) {
      const timer = window.setTimeout(() => {
        pendingDeleteTimers.current.delete(id);
        window.api.timers.delete(id);
        setPendingDeleteIds((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
      }, UNDO_DELETE_WINDOW_MS);
      pendingDeleteTimers.current.set(id, timer);
    }
  }
  function cancelPendingDelete(ids) {
    for (const id of ids) {
      const timer = pendingDeleteTimers.current.get(id);
      if (timer != null) {
        window.clearTimeout(timer);
        pendingDeleteTimers.current.delete(id);
      }
    }
    setPendingDeleteIds((previous) => {
      const next = new Set(previous);
      for (const id of ids) next.delete(id);
      return next;
    });
  }
  function handleDeleteTimer(id) {
    const timer = snapshot.timers.find((t) => t.id === id);
    scheduleDelete([id]);
    pushToast(`Deleted “${timer?.title ?? "timer"}”`, {
      actionLabel: "Undo",
      onAction: () => cancelPendingDelete([id]),
      durationMs: UNDO_DELETE_WINDOW_MS
    });
  }
  function handleBulkDelete(ids, sectionLabel) {
    if (ids.length === 0) return;
    scheduleDelete(ids);
    pushToast(`Deleted ${ids.length} timer${ids.length === 1 ? "" : "s"} from ${sectionLabel}`, {
      actionLabel: "Undo",
      onAction: () => cancelPendingDelete(ids),
      durationMs: UNDO_DELETE_WINDOW_MS
    });
  }
  function handleToggleConfirmed(id) {
    window.api.timers.toggleLoggedConfirmed(id);
  }
  function handleLinkOpened(id) {
    window.api.timers.markLinkOpened(id);
  }
  function handleCheckAll(ids, sectionLabel, confirmed) {
    if (ids.length === 0) return;
    window.api.timers.setLoggedConfirmed(ids, confirmed);
    pushToast(`Marked ${ids.length} timer${ids.length === 1 ? "" : "s"} from ${sectionLabel} as ${confirmed ? "logged" : "not logged"}`);
  }
  function handleDeleteChecked() {
    const ids = historyTimers.filter((timer) => timer.loggedConfirmedAt != null).map((timer) => timer.id);
    if (ids.length === 0) return;
    scheduleDelete(ids);
    pushToast(`Deleted ${ids.length} checked timer${ids.length === 1 ? "" : "s"}`, {
      actionLabel: "Undo",
      onAction: () => cancelPendingDelete(ids),
      durationMs: UNDO_DELETE_WINDOW_MS
    });
  }
  const activeTimers = snapshot.timers.filter((t) => t.status === "running" || t.status === "paused");
  const historyTimers = snapshot.timers.filter((t) => t.status === "stopped" && !pendingDeleteIds.has(t.id));
  const history = groupHistory(historyTimers, Date.now());
  const checkedCount = historyTimers.filter((timer) => timer.loggedConfirmedAt != null).length;
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === "paused");
  (settings?.highlightPausedTimers ?? false) && allActivePaused;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ToastStack, { toasts, onDismiss: dismissToast }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "app__header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Time Tracker" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__header-actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "icon-button settings-cog-button",
            onClick: () => window.api.app.openStats(),
            "aria-label": "Archive & stats",
            title: "Archive & stats",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChartIcon, {})
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-popover-wrapper", ref: settingsRef, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "icon-button settings-cog-button",
              onClick: () => setSettingsOpen((open) => !open),
              "aria-label": "Settings",
              title: "Settings",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(GearIcon, {})
            }
          ),
          settingsOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-popover", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-popover__group", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "settings-popover__label", children: "Overlay position" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dock-toggle", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: settings?.dockSide === "left" ? "is-selected" : "",
                    onClick: () => handleDockSideChange("left"),
                    children: "Left"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: settings?.dockSide === "right" ? "is-selected" : "",
                    onClick: () => handleDockSideChange("right"),
                    children: "Right"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-toggle", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "checkbox",
                  checked: settings?.highlightPausedTimers ?? false,
                  onChange: handleToggleHighlightPaused
                }
              ),
              "Highlight when all timers are paused"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "settings-popover__divider" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-popover__group", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "settings-popover__label", children: "Browser extension" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "browser-pairing", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `browser-pairing__dot${pairingInfo?.connected ? " is-connected" : ""}` }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: pairingInfo?.connected ? "Connected" : "Not connected" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "browser-pairing__token-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "browser-pairing__token", children: pairingInfo?.token ?? "…" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleCopyPairingToken, children: "Copy token" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "browser-pairing__domain", children: [
                "Only show open tabs & history matching this domain:",
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "text",
                    value: domainFilterInput,
                    onChange: (e) => setDomainFilterInput(e.target.value),
                    onBlur: commitDomainFilter,
                    onKeyDown: (e) => e.key === "Enter" && e.target.blur(),
                    placeholder: "atlassian.net"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("ol", { className: "extension-guide__steps", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Download the extension below and unzip it." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
                  "Open ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "chrome://extensions" }),
                  " and turn on Developer mode."
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Click “Load unpacked” and select the unzipped folder." }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: "Paste the pairing token above into the extension’s options page." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "browser-pairing__token-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "browser-pairing__token", children: "chrome://extensions/" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleOpenChromeExtensions, children: "Open" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleCopyChromeExtensionsLink, children: "Copy" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "browser-pairing__token-row", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleDownloadExtension, children: "Download extension (.zip)" }) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "settings-popover__divider" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-popover__group", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "settings-popover__label", children: "Clockwork" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-toggle", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: settings?.clockworkSyncEnabled ?? false, onChange: handleToggleClockworkSync }),
                "Log time to Clockwork automatically"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "browser-pairing", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `browser-pairing__dot${clockworkStatus?.hasToken ? " is-connected" : ""}` }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: clockworkStatus?.hasToken ? "API token set" : "No API token set" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "browser-pairing__token-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "password",
                    className: "clockwork-token-input",
                    value: clockworkTokenInput,
                    onChange: (e) => setClockworkTokenInput(e.target.value),
                    onKeyDown: (e) => e.key === "Enter" && handleSaveClockworkToken(),
                    placeholder: "Paste Clockwork API token"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleSaveClockworkToken, disabled: !clockworkTokenInput.trim(), children: "Save" }),
                clockworkStatus?.hasToken && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleClearClockworkToken, children: "Clear" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Applies automatically to any timer tagged with a Jira issue link (e.g. “.../browse/SSP-13”) — no per-tag setup needed." })
            ] })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "history-toolbar", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        type: "button",
        className: "icon-button icon-button--danger",
        onClick: handleDeleteChecked,
        disabled: checkedCount === 0,
        "aria-label": "Delete checked timers",
        title: "Delete every timer checked as logged",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            "Delete checked (",
            checkedCount,
            ")"
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
          "Today (",
          history.today.length,
          ")"
        ] }),
        history.today.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-actions", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              className: "check-all-checkbox",
              checked: history.today.every((timer) => timer.loggedConfirmedAt != null),
              onChange: (event) => handleCheckAll(history.today.map((timer) => timer.id), "today", event.target.checked),
              "aria-label": "Check all of today's timers as logged",
              title: "Check all of today's timers as logged"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "icon-button icon-button--danger",
              onClick: () => handleBulkDelete(history.today.map((timer) => timer.id), "today"),
              "aria-label": "Delete all of today's timers",
              title: "Delete all of today's timers",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {})
            }
          )
        ] })
      ] }),
      history.today.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing saved today yet." }),
      history.today.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        HistoryTimerRow,
        {
          timer,
          onDelete: handleDeleteTimer,
          onToggleConfirmed: handleToggleConfirmed,
          onLinkOpened: handleLinkOpened
        },
        timer.id
      ))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
          "This week (",
          history.thisWeek.length,
          ")"
        ] }),
        history.thisWeek.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-actions", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              className: "check-all-checkbox",
              checked: history.thisWeek.every((timer) => timer.loggedConfirmedAt != null),
              onChange: (event) => handleCheckAll(history.thisWeek.map((timer) => timer.id), "this week", event.target.checked),
              "aria-label": "Check all of this week's timers as logged",
              title: "Check all of this week's timers as logged"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "icon-button icon-button--danger",
              onClick: () => handleBulkDelete(history.thisWeek.map((timer) => timer.id), "this week"),
              "aria-label": "Delete all of this week's timers",
              title: "Delete all of this week's timers",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {})
            }
          )
        ] })
      ] }),
      history.thisWeek.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing earlier this week." }),
      history.thisWeek.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        HistoryTimerRow,
        {
          timer,
          onDelete: handleDeleteTimer,
          onToggleConfirmed: handleToggleConfirmed,
          onLinkOpened: handleLinkOpened
        },
        timer.id
      ))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
          "Older (",
          history.older.length,
          ")"
        ] }),
        history.older.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app__section-actions", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              className: "check-all-checkbox",
              checked: history.older.every((timer) => timer.loggedConfirmedAt != null),
              onChange: (event) => handleCheckAll(history.older.map((timer) => timer.id), "older", event.target.checked),
              "aria-label": "Check all older timers as logged",
              title: "Check all older timers as logged"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "icon-button icon-button--danger",
              onClick: () => handleBulkDelete(history.older.map((timer) => timer.id), "older"),
              "aria-label": "Delete all older timers",
              title: "Delete all older timers",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {})
            }
          )
        ] })
      ] }),
      history.older.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing older." }),
      history.older.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        HistoryTimerRow,
        {
          timer,
          onDelete: handleDeleteTimer,
          onToggleConfirmed: handleToggleConfirmed,
          onLinkOpened: handleLinkOpened
        },
        timer.id
      ))
    ] })
  ] });
}
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
