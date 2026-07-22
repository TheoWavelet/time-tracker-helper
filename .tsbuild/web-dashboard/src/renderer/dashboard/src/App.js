import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { StartTimerForm } from '../../shared/StartTimerForm';
import { TimerRow } from '../../shared/TimerRow';
const timerActions = {
    onPause: (id) => window.api.timers.pause(id),
    onResume: (id) => window.api.timers.resume(id),
    onStop: (id) => window.api.timers.stop(id),
    onSubmit: (id, tagLabel) => window.api.timers.submit(id, tagLabel),
    onDiscard: (id) => window.api.timers.discard(id)
};
export function App() {
    const [snapshot, setSnapshot] = useState(null);
    const [settings, setSettings] = useState(null);
    useEffect(() => {
        window.api.timers.getSnapshot().then(setSnapshot);
        window.api.settings.get().then(setSettings);
        return window.api.timers.onChanged(setSnapshot);
    }, []);
    async function handleDockSideChange(dockSide) {
        const updated = await window.api.settings.setDockSide(dockSide);
        setSettings(updated);
    }
    if (!snapshot) {
        return _jsx("div", { className: "app-loading", children: "Loading\u2026" });
    }
    const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused');
    const readyTimers = snapshot.timers.filter((t) => t.status === 'stopped');
    const historyTimers = snapshot.timers.filter((t) => t.status === 'submitted' || t.status === 'discarded');
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "app__header", children: [_jsx("h1", { children: "Time Tracker" }), _jsxs("div", { className: "dock-toggle", children: [_jsx("span", { children: "Overlay position:" }), _jsx("button", { className: settings?.dockSide === 'left' ? 'is-selected' : '', onClick: () => handleDockSideChange('left'), children: "Left" }), _jsx("button", { className: settings?.dockSide === 'right' ? 'is-selected' : '', onClick: () => handleDockSideChange('right'), children: "Right" })] })] }), _jsxs("section", { className: "app__section", children: [_jsx("h2", { children: "Start a timer" }), _jsx(StartTimerForm, { onStart: (value) => window.api.timers.start(value) })] }), _jsxs("section", { className: "app__section", children: [_jsxs("h2", { children: ["Active (", activeTimers.length, ")"] }), activeTimers.length === 0 && _jsx("p", { className: "app__empty", children: "Nothing running right now." }), activeTimers.map((timer) => (_jsx(TimerRow, { timer: timer, ...timerActions }, timer.id)))] }), _jsxs("section", { className: "app__section", children: [_jsxs("h2", { children: ["Ready to submit (", readyTimers.length, ")"] }), readyTimers.length === 0 && _jsx("p", { className: "app__empty", children: "Nothing waiting to be logged." }), readyTimers.map((timer) => (_jsx(TimerRow, { timer: timer, ...timerActions }, timer.id)))] }), _jsxs("section", { className: "app__section", children: [_jsx("h2", { children: "History" }), historyTimers.length === 0 && _jsx("p", { className: "app__empty", children: "No submitted or discarded timers yet." }), historyTimers.map((timer) => (_jsx(TimerRow, { timer: timer, ...timerActions }, timer.id)))] })] }));
}
