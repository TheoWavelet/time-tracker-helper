import { r as reactExports, j as jsxRuntimeExports, L as LogsIcon, S as StartTimerForm, a as TimerRow, u as useElapsedMs, b as formatElapsedClock, c as client, R as React } from "./TimerRow-PhW8Pnmt.js";
const CLICK_MOVEMENT_THRESHOLD_PX = 4;
let dragInProgress = false;
function isWindowDragInProgress() {
  return dragInProgress;
}
function startWindowDrag(event, onClick) {
  event.preventDefault();
  dragInProgress = true;
  window.api.overlay.dragStart();
  const startScreenY = event.screenY;
  let maxMovement = 0;
  let frameRequested = false;
  function onMouseMove(moveEvent) {
    maxMovement = Math.max(maxMovement, Math.abs(moveEvent.screenY - startScreenY));
    if (maxMovement < CLICK_MOVEMENT_THRESHOLD_PX) return;
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      window.api.overlay.dragMove();
    });
  }
  function onMouseUp() {
    dragInProgress = false;
    window.api.overlay.dragEnd();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    if (onClick && maxMovement < CLICK_MOVEMENT_THRESHOLD_PX) onClick();
  }
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
const timerActions = {
  onPause: (id) => window.api.timers.pause(id),
  onResume: (id) => window.api.timers.resume(id),
  onStop: (id) => window.api.timers.stop(id)
};
const COLLAPSE_DELAY_MS = 250;
function BarRow({
  timer,
  onClick,
  showTitle
}) {
  const elapsed = useElapsedMs(timer);
  const className = [
    "bar-row",
    timer.status === "running" ? "bar-row--running" : "",
    showTitle ? "bar-row--wide" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className, title: timer.title, onMouseDown: (e) => startWindowDrag(e, onClick), children: [
    showTitle && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__title", children: timer.title }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__clock", children: formatElapsedClock(elapsed) })
  ] });
}
function App() {
  const [snapshot, setSnapshot] = reactExports.useState(null);
  const [expanded, setExpanded] = reactExports.useState(false);
  const [barWide, setBarWideState] = reactExports.useState(false);
  const collapseTimerRef = reactExports.useRef(void 0);
  reactExports.useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot);
    return window.api.timers.onChanged(setSnapshot);
  }, []);
  async function toggleExpanded(next) {
    await window.api.overlay.setExpanded(next);
    setExpanded(next);
  }
  function cancelScheduledCollapse() {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = void 0;
    }
  }
  function scheduleCollapse() {
    cancelScheduledCollapse();
    collapseTimerRef.current = window.setTimeout(() => {
      void toggleExpanded(false);
    }, COLLAPSE_DELAY_MS);
  }
  function handleSeeMoreMouseEnter() {
    if (!isWindowDragInProgress()) void toggleExpanded(true);
  }
  function handlePanelMouseLeave() {
    if (!isWindowDragInProgress()) scheduleCollapse();
  }
  function toggleTimer(timer) {
    if (timer.status === "running") window.api.timers.pause(timer.id);
    else window.api.timers.resume(timer.id);
  }
  function handleStackMouseEnter() {
    if (isWindowDragInProgress()) return;
    setBarWideState(true);
    window.api.overlay.setBarWide(true);
  }
  function handleStackMouseLeave() {
    if (isWindowDragInProgress()) return;
    setBarWideState(false);
    window.api.overlay.setBarWide(false);
  }
  if (!snapshot) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bar-container" });
  const activeTimers = snapshot.timers.filter((t) => t.status === "running" || t.status === "paused");
  if (!expanded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bar-container", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bar-stack", onMouseEnter: handleStackMouseEnter, onMouseLeave: handleStackMouseLeave, children: activeTimers.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: `bar-row${barWide ? " bar-row--wide" : ""}`,
          title: "No timer running",
          onMouseDown: (e) => startWindowDrag(e),
          children: [
            barWide && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__title", children: "No timer running" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__clock", children: "--:--" })
          ]
        }
      ) : activeTimers.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(BarRow, { timer, onClick: () => toggleTimer(timer), showTitle: barWide }, timer.id)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "see-more", onMouseEnter: handleSeeMoreMouseEnter, "aria-label": "Show more", children: "⌄" })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel", onMouseEnter: cancelScheduledCollapse, onMouseLeave: handlePanelMouseLeave, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel__header", onMouseDown: startWindowDrag, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Time Tracker" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel__header-actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "panel__history-button icon-button",
            onMouseDown: (e) => e.stopPropagation(),
            onClick: () => window.api.app.openDashboard(),
            "aria-label": "Open logs",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(LogsIcon, {})
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "panel__collapse",
            onMouseDown: (e) => e.stopPropagation(),
            onClick: () => toggleExpanded(false),
            "aria-label": "Collapse",
            children: "✕"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel__body", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StartTimerForm, { onStart: (value) => window.api.timers.start(value) }),
      activeTimers.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "panel__section", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Active" }),
        activeTimers.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(TimerRow, { timer, ...timerActions }, timer.id))
      ] })
    ] })
  ] });
}
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
