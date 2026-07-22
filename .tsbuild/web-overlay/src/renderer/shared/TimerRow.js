import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useElapsedMs } from './useElapsedTime';
import { formatElapsedClock, formatDurationHuman } from '@shared/format';
function statusLabel(timer) {
    switch (timer.status) {
        case 'running':
            return 'Running';
        case 'paused':
            return timer.pausedReason === 'switched'
                ? `Paused — switched to "${timer.switchedToTitle ?? '…'}"`
                : 'Paused by you';
        case 'stopped':
            return 'Ready to submit';
        case 'submitted':
            return 'Submitted';
        case 'discarded':
            return 'Discarded';
        default:
            return '';
    }
}
export function TimerRow({ timer, onPause, onResume, onStop, onSubmit, onDiscard }) {
    const elapsed = useElapsedMs(timer);
    const [tagLabel, setTagLabel] = useState(timer.tagLabel ?? '');
    function handleDiscard() {
        if (window.confirm("Discard this timer? Its tracked time won't be counted."))
            onDiscard(timer.id);
    }
    const canDiscard = timer.status === 'running' || timer.status === 'paused' || timer.status === 'stopped';
    return (_jsxs("div", { className: `timer-row timer-row--${timer.status}`, children: [_jsxs("div", { className: "timer-row__main", children: [_jsx("span", { className: "timer-row__title", children: timer.title }), _jsx("span", { className: "timer-row__clock", children: formatElapsedClock(elapsed) })] }), _jsxs("div", { className: "timer-row__meta", children: [_jsx("span", { className: "timer-row__status", children: statusLabel(timer) }), _jsx("span", { className: "timer-row__kind", children: timer.kind === 'one_off' ? 'Quick' : 'Ongoing' })] }), _jsxs("div", { className: "timer-row__actions", children: [timer.status === 'running' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => onPause(timer.id), children: "Pause" }), _jsx("button", { onClick: () => onStop(timer.id), children: "Stop" })] })), timer.status === 'paused' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => onResume(timer.id), children: "Switch to this timer" }), _jsx("button", { onClick: () => onStop(timer.id), children: "Stop" })] })), timer.status === 'stopped' && (_jsxs(_Fragment, { children: [_jsx("input", { className: "timer-row__tag-input", type: "text", value: tagLabel, onChange: (e) => setTagLabel(e.target.value), placeholder: "Choose where to log\u2026" }), _jsx("button", { disabled: !tagLabel.trim(), onClick: () => onSubmit(timer.id, tagLabel.trim()), children: "Submit" })] })), timer.status === 'submitted' && (_jsxs("span", { className: "timer-row__submitted-summary", children: ["Logged ", formatDurationHuman(timer.accumulatedMs), " to ", timer.tagLabel] })), canDiscard && (_jsx("button", { className: "timer-row__discard", onClick: handleDiscard, children: "Discard" }))] })] }));
}
