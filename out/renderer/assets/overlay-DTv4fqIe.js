import { r as reactExports, f as formatDefaultTimerTitle, j as jsxRuntimeExports, P as PlusIcon, b as ClockPlusIcon, u as useToasts, d as ChevronDownIcon, T as ToastStack, L as LogsIcon, e as TimerRow, H as HistoryTimerRow, g as useElapsedMs, h as useStatusPulse, i as formatElapsedClock, c as client, R as React } from "./TimerRows-UXKhS_Fe.js";
const BROWSER_PAGE_SIZE = 50;
function sortTags(tags, view) {
  return [...tags].sort(
    (first, second) => view === "most_used" ? second.usageCount - first.usageCount || first.label.localeCompare(second.label) : (second.lastUsedAt ?? 0) - (first.lastUsedAt ?? 0) || first.label.localeCompare(second.label)
  );
}
function matchesQuery(query, title, url) {
  return !query || title.toLowerCase().includes(query) || url.toLowerCase().includes(query);
}
function PickerRow({ title, url, isFavorite, onPick, onToggleFavorite }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__row--tag", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "tag-picker__row-main", onClick: onPick, title: url, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag-picker__row-label", children: title }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: `tag-picker__favorite-btn${isFavorite ? " is-favorite" : ""}`,
        onClick: (event) => {
          event.stopPropagation();
          onToggleFavorite();
        },
        title: isFavorite ? "Remove from favorites" : "Add to favorites",
        "aria-label": isFavorite ? "Remove from favorites" : "Add to favorites",
        children: "★"
      }
    )
  ] });
}
function TagPicker({ value, onChange, onPickTag, placeholder }) {
  const [open, setOpen] = reactExports.useState(false);
  const [view, setView] = reactExports.useState("all");
  const [allTags, setAllTags] = reactExports.useState([]);
  const [openTabs, setOpenTabs] = reactExports.useState([]);
  const [domainHistory, setDomainHistory] = reactExports.useState([]);
  const [domainFilter, setDomainFilter] = reactExports.useState("");
  const [browserPageCount, setBrowserPageCount] = reactExports.useState(BROWSER_PAGE_SIZE);
  const wrapperRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open) return;
    function handleOutsideMouseDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, [open]);
  function openDropdown() {
    setOpen(true);
    window.api.tags.listForPicker().then(setAllTags);
    window.api.browser.listOpenTabs().then(setOpenTabs);
    window.api.browser.searchHistoryByDomain().then(setDomainHistory);
    window.api.settings.get().then((settings) => setDomainFilter(settings.browserDomainFilter));
  }
  function upsertTag(tag) {
    setAllTags(
      (previous) => previous.some((current) => current.id === tag.id) ? previous.map((current) => current.id === tag.id ? tag : current) : [...previous, tag]
    );
  }
  function isLabelFavorited(title) {
    return allTags.find((tag) => tag.label === title)?.isFavorite ?? false;
  }
  async function handlePickBrowserEntry(title, url) {
    const tag = await window.api.tags.findOrCreateByLabelAndUrl(title, url);
    onPickTag(tag);
    setOpen(false);
  }
  async function handleToggleFavorite(id) {
    const updated = await window.api.tags.toggleFavorite(id);
    upsertTag(updated);
  }
  async function handleToggleFavoriteForEntry(title, url) {
    const tag = await window.api.tags.findOrCreateByLabelAndUrl(title, url);
    const updated = await window.api.tags.toggleFavorite(tag.id);
    upsertTag(updated);
  }
  const query = value.trim().toLowerCase();
  const filtered = allTags.filter((tag) => view !== "favorites" || tag.isFavorite).filter((tag) => !query || tag.label.toLowerCase().includes(query) || tag.targetUrl?.toLowerCase().includes(query));
  const visible = sortTags(filtered, view);
  const visibleTabs = openTabs.filter((tab) => matchesQuery(query, tab.title, tab.url));
  const visibleHistory = domainHistory.filter((item) => matchesQuery(query, item.title, item.url));
  const domainSuffix = domainFilter ? ` (${domainFilter})` : "";
  const allBrowserItems = [
    ...visibleTabs.map((tab, index) => ({ key: `tab-${tab.url}-${index}`, title: tab.title, url: tab.url })),
    ...visibleHistory.map((item) => ({ key: `history-${item.url}-${item.lastVisitTime}`, title: item.title, url: item.url }))
  ];
  const visibleBrowserItems = allBrowserItems.slice(0, browserPageCount);
  reactExports.useEffect(() => {
    setBrowserPageCount(BROWSER_PAGE_SIZE);
  }, [query, open]);
  function handleBrowserListScroll(event) {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight < list.scrollHeight - 24) return;
    setBrowserPageCount((count) => Math.min(allBrowserItems.length, count + BROWSER_PAGE_SIZE));
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker", ref: wrapperRef, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        className: "tag-picker__input",
        type: "text",
        value,
        onChange: (event) => onChange(event.target.value),
        onFocus: openDropdown,
        onClick: openDropdown,
        onKeyDown: (event) => event.key === "Escape" && setOpen(false),
        placeholder
      }
    ),
    open && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__dropdown", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tag-picker__header", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: view === "all" ? "is-active" : "", onClick: () => setView("all"), children: "All" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: view === "recent" ? "is-active" : "", onClick: () => setView("recent"), children: "Recent" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: view === "most_used" ? "is-active" : "", onClick: () => setView("most_used"), children: "Most used" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: view === "favorites" ? "is-active" : "", onClick: () => setView("favorites"), children: "★ Favorites" })
      ] }) }),
      view === "all" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__list", onScroll: handleBrowserListScroll, children: [
        visibleBrowserItems.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__empty", children: [
          "No open tabs or history",
          domainSuffix ? ` match${domainSuffix}` : ""
        ] }),
        visibleBrowserItems.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          PickerRow,
          {
            title: item.title,
            url: item.url,
            isFavorite: isLabelFavorited(item.title),
            onPick: () => handlePickBrowserEntry(item.title, item.url),
            onToggleFavorite: () => handleToggleFavoriteForEntry(item.title, item.url)
          },
          item.key
        ))
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tag-picker__list", children: [
        visible.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tag-picker__empty", children: "No matching tags — Start will use this as a plain title" }),
        visible.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx(PickerRow, { title: tag.label, url: tag.targetUrl ?? void 0, isFavorite: tag.isFavorite, onPick: () => {
          onPickTag(tag);
          setOpen(false);
        }, onToggleFavorite: () => handleToggleFavorite(tag.id) }, tag.id))
      ] })
    ] })
  ] });
}
const DEFAULT_CUSTOM_LOG_HOURS = "0";
const DEFAULT_CUSTOM_LOG_MINUTES = "15";
function StartTimerForm({ onStart, onCreateCustomLog }) {
  const [text, setText] = reactExports.useState("");
  const [pickedTag, setPickedTag] = reactExports.useState(null);
  const [customLogOpen, setCustomLogOpen] = reactExports.useState(false);
  const [customLogHours, setCustomLogHours] = reactExports.useState(DEFAULT_CUSTOM_LOG_HOURS);
  const [customLogMinutes, setCustomLogMinutes] = reactExports.useState(DEFAULT_CUSTOM_LOG_MINUTES);
  const customLogRef = reactExports.useRef(null);
  const defaultTitlePreview = formatDefaultTimerTitle(Date.now());
  const totalCustomLogMinutes = Math.round((Number(customLogHours) || 0) * 60 + (Number(customLogMinutes) || 0));
  const isCustomLogDurationValid = totalCustomLogMinutes >= 1 && totalCustomLogMinutes <= 24 * 60;
  reactExports.useEffect(() => {
    if (!customLogOpen) return;
    function handleOutsideMouseDown(event) {
      if (customLogRef.current && !customLogRef.current.contains(event.target)) setCustomLogOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, [customLogOpen]);
  function handleChange(newText) {
    setText(newText);
    if (pickedTag && newText !== pickedTag.label) setPickedTag(null);
  }
  function handlePickTag(tag) {
    setText(tag.label);
    setPickedTag(tag);
  }
  function currentValue() {
    return { title: pickedTag ? pickedTag.label : text.trim() || void 0, tagLabel: pickedTag ? pickedTag.label : void 0 };
  }
  function handleSubmit(event) {
    event.preventDefault();
    onStart(currentValue());
    setText("");
    setPickedTag(null);
  }
  function handleCreateCustomLog() {
    if (!isCustomLogDurationValid) return;
    onCreateCustomLog(currentValue(), totalCustomLogMinutes);
    setText("");
    setPickedTag(null);
    setCustomLogHours(DEFAULT_CUSTOM_LOG_HOURS);
    setCustomLogMinutes(DEFAULT_CUSTOM_LOG_MINUTES);
    setCustomLogOpen(false);
  }
  function handleCustomLogKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateCustomLog();
    } else if (event.key === "Escape") {
      setCustomLogOpen(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { className: "start-timer-form", onSubmit: handleSubmit, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TagPicker, { value: text, onChange: handleChange, onPickTag: handlePickTag, placeholder: `Plain title (e.g. ${defaultTitlePreview}) or pick a tag…` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "icon-button icon-button--add", "aria-label": "Start timer", children: /* @__PURE__ */ jsxRuntimeExports.jsx(PlusIcon, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "custom-log-popover-wrapper", ref: customLogRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "icon-button icon-button--custom-log",
          onClick: () => setCustomLogOpen((open) => !open),
          "aria-label": "Log custom duration",
          title: "Log custom duration — uses the title/tag above",
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(ClockPlusIcon, {})
        }
      ),
      customLogOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "custom-log-popover", onKeyDown: handleCustomLogKeyDown, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "custom-log-popover__fields", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "number",
                value: customLogHours,
                onChange: (event) => setCustomLogHours(event.target.value),
                min: 0,
                max: 24,
                step: 1,
                autoFocus: true
              }
            ),
            "h"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "number",
                value: customLogMinutes,
                onChange: (event) => setCustomLogMinutes(event.target.value),
                min: 0,
                max: 59,
                step: 1
              }
            ),
            "m"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "icon-button icon-button--add custom-log-popover__submit",
            onClick: handleCreateCustomLog,
            disabled: !isCustomLogDurationValid,
            "aria-label": "Confirm custom log",
            children: "Log"
          }
        )
      ] })
    ] })
  ] });
}
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
const COLLAPSE_DELAY_MS = 250;
const EXPAND_DELAY_MS = 300;
const NEW_TIMER_FLASH_MS = 1800;
function BarRow({
  timer,
  onClick,
  showTitle,
  highlightPaused,
  isNew
}) {
  const elapsed = useElapsedMs(timer);
  const pulse = useStatusPulse(timer.status, timer.pausedReason);
  const className = [
    "bar-row",
    timer.status === "running" ? "bar-row--running" : "",
    highlightPaused && timer.status === "paused" ? "bar-row--paused-alert" : "",
    showTitle ? "bar-row--wide" : "",
    isNew ? "bar-row--new-timer" : "",
    pulse ?? ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className, title: timer.title, onMouseDown: (e) => startWindowDrag(e, onClick), children: [
    showTitle && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__title", children: timer.title }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bar-row__clock", children: formatElapsedClock(elapsed) })
  ] });
}
function App() {
  const [snapshot, setSnapshot] = reactExports.useState(null);
  const [settings, setSettings] = reactExports.useState(null);
  const [expanded, setExpanded] = reactExports.useState(false);
  const [barWide, setBarWideState] = reactExports.useState(false);
  const collapseTimerRef = reactExports.useRef(void 0);
  const expandTimerRef = reactExports.useRef(void 0);
  const [recentCustomLogIds, setRecentCustomLogIds] = reactExports.useState([]);
  const [newTimerId, setNewTimerId] = reactExports.useState(null);
  const { toasts, pushToast } = useToasts();
  reactExports.useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot);
    window.api.settings.get().then(setSettings);
    const offTimers = window.api.timers.onChanged(setSnapshot);
    const offSettings = window.api.settings.onChanged(setSettings);
    return () => {
      offTimers();
      offSettings();
      if (expandTimerRef.current != null) window.clearTimeout(expandTimerRef.current);
      if (collapseTimerRef.current != null) window.clearTimeout(collapseTimerRef.current);
    };
  }, []);
  async function toggleExpanded(next) {
    await window.api.overlay.setExpanded(next);
    setExpanded(next);
    if (!next) {
      setRecentCustomLogIds([]);
      setBarWideState(false);
    }
  }
  function cancelScheduledCollapse() {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = void 0;
    }
  }
  function cancelScheduledExpand() {
    if (expandTimerRef.current != null) {
      window.clearTimeout(expandTimerRef.current);
      expandTimerRef.current = void 0;
    }
  }
  function scheduleCollapse() {
    cancelScheduledCollapse();
    collapseTimerRef.current = window.setTimeout(() => {
      void toggleExpanded(false);
    }, COLLAPSE_DELAY_MS);
  }
  function handleSeeMoreMouseEnter() {
    if (isWindowDragInProgress()) return;
    cancelScheduledExpand();
    expandTimerRef.current = window.setTimeout(() => {
      if (!isWindowDragInProgress()) void toggleExpanded(true);
    }, EXPAND_DELAY_MS);
  }
  function handlePanelMouseLeave() {
    if (!isWindowDragInProgress()) scheduleCollapse();
  }
  function handlePanelMouseEnter() {
    cancelScheduledCollapse();
  }
  function handleSeeMoreMouseLeave() {
    cancelScheduledExpand();
  }
  function toggleTimer(timer) {
    if (timer.status === "running") window.api.timers.pause(timer.id);
    else window.api.timers.resume(timer.id);
  }
  function handleBarContainerMouseEnter() {
    if (isWindowDragInProgress()) return;
    setBarWideState(true);
    window.api.overlay.setBarWide(true);
  }
  function handleBarContainerMouseLeave() {
    if (isWindowDragInProgress()) return;
    setBarWideState(false);
    window.api.overlay.setBarWide(false);
  }
  function handlePauseFromPanel(id) {
    const timer = snapshot?.timers.find((t) => t.id === id);
    window.api.timers.pause(id);
    pushToast(`Paused “${timer?.title ?? "timer"}”`);
  }
  function handleDeleteFromPanel(id) {
    const timer = snapshot?.timers.find((t) => t.id === id);
    window.api.timers.delete(id);
    pushToast(`Deleted “${timer?.title ?? "timer"}”`);
  }
  async function handleStartFromPanel(value) {
    const created = await window.api.timers.start(value);
    pushToast(`Started “${created.title}”`);
    setNewTimerId(created.id);
    window.setTimeout(() => {
      setNewTimerId((current) => current === created.id ? null : current);
    }, NEW_TIMER_FLASH_MS);
    void toggleExpanded(false);
  }
  async function handleCreateCustomLog(value, durationMinutes) {
    const created = await window.api.timers.createCustomLog({ ...value, durationMinutes });
    setRecentCustomLogIds((ids) => [created.id, ...ids]);
    pushToast(`Logged ${durationMinutes} min for “${created.title}”`);
  }
  const panelTimerActions = {
    onPause: handlePauseFromPanel,
    onResume: (id) => window.api.timers.resume(id),
    onStop: (id) => window.api.timers.stop(id),
    onDelete: handleDeleteFromPanel
  };
  if (!snapshot) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bar-container" });
  const activeTimers = snapshot.timers.filter((t) => t.status === "running" || t.status === "paused");
  const recentCustomLogs = recentCustomLogIds.map((id) => snapshot.timers.find((timer) => timer.id === id)).filter((timer) => timer != null);
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === "paused");
  const highlightPaused = (settings?.highlightPausedTimers ?? false) && allActivePaused;
  if (!expanded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bar-container", onMouseEnter: handleBarContainerMouseEnter, onMouseLeave: handleBarContainerMouseLeave, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bar-stack", children: activeTimers.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
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
      ) : activeTimers.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        BarRow,
        {
          timer,
          onClick: () => toggleTimer(timer),
          showTitle: barWide,
          highlightPaused,
          isNew: timer.id === newTimerId
        },
        timer.id
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "see-more", onMouseEnter: handleSeeMoreMouseEnter, onMouseLeave: handleSeeMoreMouseLeave, "aria-label": "Show more", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDownIcon, {}) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel", onMouseEnter: handlePanelMouseEnter, onMouseLeave: handlePanelMouseLeave, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ToastStack, { toasts }),
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
      /* @__PURE__ */ jsxRuntimeExports.jsx(StartTimerForm, { onStart: handleStartFromPanel, onCreateCustomLog: handleCreateCustomLog }),
      activeTimers.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "panel__section", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Active" }),
        activeTimers.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          TimerRow,
          {
            timer,
            ...panelTimerActions,
            highlightPaused,
            isNew: timer.id === newTimerId
          },
          timer.id
        ))
      ] }),
      recentCustomLogs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "panel__section", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Just logged" }),
        recentCustomLogs.map((timer) => /* @__PURE__ */ jsxRuntimeExports.jsx(HistoryTimerRow, { timer, onDelete: (id) => window.api.timers.delete(id) }, timer.id))
      ] })
    ] })
  ] });
}
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
