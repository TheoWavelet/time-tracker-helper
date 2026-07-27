import { r as reactExports, j as jsxRuntimeExports, k as formatDurationHuman, a as TrashIcon, H as HistoryTimerRow, c as client, R as React } from "./TimerRows-UXKhS_Fe.js";
function App() {
  const [weeklyStats, setWeeklyStats] = reactExports.useState(null);
  const [archived, setArchived] = reactExports.useState(null);
  function refetch() {
    window.api.stats.getWeekly().then(setWeeklyStats);
    window.api.archive.list().then(setArchived);
  }
  reactExports.useEffect(() => {
    refetch();
    return window.api.timers.onChanged(refetch);
  }, []);
  async function handleClearArchive() {
    await window.api.archive.clear();
    setArchived([]);
  }
  if (!weeklyStats || !archived) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "app-loading", children: "Loading…" });
  }
  const maxDayMs = Math.max(1, ...weeklyStats.days.map((d) => d.totalMs));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "app__header", children: /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Archive & Stats" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "This week" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "week-chart", children: weeklyStats.days.map((day) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `week-chart__col${day.isFuture ? " is-future" : ""}`, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "week-chart__value", children: day.totalMs > 0 ? formatDurationHuman(day.totalMs) : "—" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "week-chart__bar-track", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "week-chart__bar", style: { height: `${day.totalMs / maxDayMs * 100}%` } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "week-chart__label", children: day.label })
      ] }, day.label)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "week-summary", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Daily average" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: formatDurationHuman(weeklyStats.dailyAverageMs) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "archive-toolbar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Deleted items" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          type: "button",
          className: "icon-button icon-button--danger",
          onClick: handleClearArchive,
          disabled: archived.length === 0,
          "aria-label": "Clear archive",
          title: "Permanently delete every item below",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TrashIcon, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "Clear archive (",
              archived.length,
              ")"
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "app__section", children: [
      archived.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "app__empty", children: "Nothing deleted yet." }),
      archived.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(HistoryTimerRow, { timer }, timer.id))
    ] })
  ] });
}
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
