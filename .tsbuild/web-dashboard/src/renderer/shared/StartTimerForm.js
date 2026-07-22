import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { formatDefaultTimerTitle } from '@shared/format';
export function StartTimerForm({ onStart, showTagField = true }) {
    const [title, setTitle] = useState('');
    const [kind, setKind] = useState('one_off');
    const [tagLabel, setTagLabel] = useState('');
    const defaultTitlePreview = formatDefaultTimerTitle(Date.now());
    function handleSubmit(event) {
        event.preventDefault();
        onStart({
            title: title.trim() || undefined,
            kind,
            tagLabel: tagLabel.trim() || undefined
        });
        setTitle('');
        setTagLabel('');
    }
    return (_jsxs("form", { className: "start-timer-form", onSubmit: handleSubmit, children: [_jsx("input", { className: "start-timer-form__title", type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: `e.g. ${defaultTitlePreview}` }), _jsxs("div", { className: "start-timer-form__kind", role: "radiogroup", "aria-label": "How long will this run?", children: [_jsx("button", { type: "button", className: kind === 'one_off' ? 'is-selected' : '', onClick: () => setKind('one_off'), children: "Quick timer" }), _jsx("button", { type: "button", className: kind === 'persistent' ? 'is-selected' : '', onClick: () => setKind('persistent'), children: "Ongoing timer" })] }), showTagField && (_jsx("input", { className: "start-timer-form__tag", type: "text", value: tagLabel, onChange: (e) => setTagLabel(e.target.value), placeholder: "Tag (optional)" })), _jsx("button", { type: "submit", className: "start-timer-form__submit", children: "Start Timer" })] }));
}
