import type { TimerKind } from '@shared/types';
export interface StartTimerFormValue {
    title?: string;
    kind: TimerKind;
    tagLabel?: string;
}
interface StartTimerFormProps {
    onStart: (value: StartTimerFormValue) => void;
    showTagField?: boolean;
}
export declare function StartTimerForm({ onStart, showTagField }: StartTimerFormProps): JSX.Element;
export {};
