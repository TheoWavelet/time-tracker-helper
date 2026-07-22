import type { TimerDTO } from '@shared/types';
interface TimerRowProps {
    timer: TimerDTO;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onStop: (id: string) => void;
    onSubmit: (id: string, tagLabel: string) => void;
    onDiscard: (id: string) => void;
}
export declare function TimerRow({ timer, onPause, onResume, onStop, onSubmit, onDiscard }: TimerRowProps): JSX.Element;
export {};
