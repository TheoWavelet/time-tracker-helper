import { j as jsxRuntimeExports, f as formatDurationHuman, T as TrashIcon, r as reactExports, S as StartTimerForm, a as TimerRow, c as client, R as React } from "./TimerRow-PhW8Pnmt.js";
function HistoryTimerRow({ timer, onDelete }) {
  function handleDelete() {
    if (window.confirm("Delete this saved timer? This cannot be undone.")) onDelete(timer.id);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "history-row", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "history-row__main", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "history-row__title", children: timer.title }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "history-row__duration", children: formatDurationHuman(timer.accumulatedMs) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "history-row__meta", children: [
      timer.tagLabel && (timer.tagTargetUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "link-button", onClick: () => window.api.shell.openExternal(timer.tagTargetUrl), children: timer.tagLabel }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "history-row__tag", children: timer.tagLabel })),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "icon-button icon-button--danger", onClick: handleDelete, "aria-label": "Delete", children: /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {}) })
    ] })
  ] });
}
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
const timerActions = {
  onPause: (id) => window.api.timers.pause(id),
  onResume: (id) => window.api.timers.resume(id),
  onStop: (id) => window.api.timers.stop(id)
};
function handleDeleteTimer(id) {
  window.api.timers.delete(id);
}
function App() {
  const [snapshot, setSnapshot] = reactExports.useState(null);
  const [settings, setSettings] = reactExports.useState(null);
  reactExports.useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot);
    window.api.settings.get().then(setSettings);
    return window.api.timers.onChanged(setSnapshot);
  }, []);
  async function handleDockSideChange(dockSide) {
    const updated = await window.api.settings.setDockSide(dockSide);
    setSettings(updated);
  }
  if (!snapshot) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "app-loading", children: "Loading…" });
  }
  const activeTimers = snapshot.timers.filter((t) => t.status === "running" || t.status === "paused");
  const historyTimers = snapshot.timers.filter((t) => t.status === "stopped");
  const history = groupHistory(historyTimers, Date.now());
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "app__header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Time Tracker" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dock-toggle", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Overlay position:" }),
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
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Start a timer" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StartTimerForm, { onStart: (value) => window.api.timers.start(value) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
        "Active (",
        activeTimers.length,
        ")"
      ] }),
      activeTimers.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing running right now." }),
      activeTimers.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(TimerRow, { timer, ...timerActions }, timer.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
        "Today (",
        history.today.length,
        ")"
      ] }),
      history.today.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing saved today yet." }),
      history.today.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(HistoryTimerRow, { timer, onDelete: handleDeleteTimer }, timer.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
        "This week (",
        history.thisWeek.length,
        ")"
      ] }),
      history.thisWeek.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing earlier this week." }),
      history.thisWeek.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(HistoryTimerRow, { timer, onDelete: handleDeleteTimer }, timer.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
        "Older (",
        history.older.length,
        ")"
      ] }),
      history.older.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing older." }),
      history.older.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(HistoryTimerRow, { timer, onDelete: handleDeleteTimer }, timer.id))
    ] })
  ] });
}
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
