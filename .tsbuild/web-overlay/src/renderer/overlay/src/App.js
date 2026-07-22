import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { formatElapsedClock } from '@shared/format';
import { useElapsedMs } from '../../shared/useElapsedTime';
import { StartTimerForm } from '../../shared/StartTimerForm';
import { TimerRow } from '../../shared/TimerRow';
const timerActions = {
    onPause: (id) => window.api.timers.pause(id),
    onResume: (id) => window.api.timers.resume(id),
    onStop: (id) => window.api.timers.stop(id),
    onSubmit: (id, tagLabel) => window.api.timers.submit(id, tagLabel),
    onDiscard: (id) => window.api.timers.discard(id)
};
const COLLAPSE_DELAY_MS = 250;
const SOLID_DELAY_MS = 500;
function BarRow({ timer }) {
    const elapsed = useElapsedMs(timer);
    return (_jsx("div", { className: "bar-row", title: timer.title, children: _jsx("span", { className: "bar-row__clock", children: formatElapsedClock(elapsed) }) }));
}
export function App() {
    const [snapshot, setSnapshot] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [solid, setSolid] = useState(false);
    const collapseTimerRef = useRef(undefined);
    useEffect(() => {
        window.api.timers.getSnapshot().then(setSnapshot);
        return window.api.timers.onChanged(setSnapshot);
    }, []);
    // The panel starts barely-there and only becomes more opaque/readable if the hover lingers,
    // so a quick pass over the bar doesn't suddenly draw a solid card on screen.
    useEffect(() => {
        if (!expanded) {
            setSolid(false);
            return;
        }
        const timer = window.setTimeout(() => setSolid(true), SOLID_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [expanded]);
    async function toggleExpanded(next) {
        await window.api.overlay.setExpanded(next);
        setExpanded(next);
    }
    function cancelScheduledCollapse() {
        if (collapseTimerRef.current != null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = undefined;
        }
    }
    function scheduleCollapse() {
        cancelScheduledCollapse();
        collapseTimerRef.current = window.setTimeout(() => {
            void toggleExpanded(false);
        }, COLLAPSE_DELAY_MS);
    }
    function expandNow() {
        cancelScheduledCollapse();
        if (!expanded)
            void toggleExpanded(true);
    }
    if (!snapshot)
        return _jsx("div", { className: "bar-stack" });
    const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused');
    if (!expanded) {
        // Hover (not click) expands into the full panel — dragging is handled natively via
        // -webkit-app-region: drag on .bar-stack (see overlay.css), which on Windows swallows
        // click events entirely, so hover is the only interaction that can live here.
        return (_jsx("div", { className: "bar-stack", onMouseEnter: expandNow, children: activeTimers.length === 0 ? (_jsx("div", { className: "bar-row", title: "No timer running", children: _jsx("span", { className: "bar-row__clock", children: "--:--" }) })) : (activeTimers.map((timer) => _jsx(BarRow, { timer: timer }, timer.id))) }));
    }
    const readyTimers = snapshot.timers.filter((t) => t.status === 'stopped');
    return (_jsxs("div", { className: `panel${solid ? ' panel--solid' : ''}`, onMouseEnter: cancelScheduledCollapse, onMouseLeave: scheduleCollapse, children: [_jsxs("div", { className: "panel__header", children: [_jsx("span", { children: "Time Tracker" }), _jsx("button", { className: "panel__collapse", onClick: () => toggleExpanded(false), "aria-label": "Collapse", children: "\u2715" })] }), _jsxs("div", { className: "panel__body", children: [_jsx(StartTimerForm, { onStart: (value) => window.api.timers.start(value) }), activeTimers.length > 0 && (_jsxs("section", { className: "panel__section", children: [_jsx("h3", { children: "Active" }), activeTimers.map((timer) => (_jsx(TimerRow, { timer: timer, ...timerActions }, timer.id)))] })), readyTimers.length > 0 && (_jsxs("section", { className: "panel__section", children: [_jsx("h3", { children: "Ready to submit" }), readyTimers.map((timer) => (_jsx(TimerRow, { timer: timer, ...timerActions }, timer.id)))] }))] })] }));
}
