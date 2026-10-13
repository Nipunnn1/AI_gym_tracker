/**
 * Workout Timer Engine
 *
 * Manages countdown timers for rest periods, warmups, and cooldowns.
 * Designed to work with React state via the useWorkoutTimer hook pattern.
 */

export interface TimerState {
    /** Total duration in seconds */
    totalSeconds: number;
    /** Remaining seconds */
    remainingSeconds: number;
    /** Whether the timer is actively counting down */
    isRunning: boolean;
    /** Timestamp when the timer was last started/resumed */
    startedAt: number | null;
    /** Whether the timer has finished (hit 0) */
    isComplete: boolean;
}

/**
 * Creates a new timer state.
 */
export function createTimer(totalSeconds: number): TimerState {
    return {
        totalSeconds,
        remainingSeconds: totalSeconds,
        isRunning: false,
        startedAt: null,
        isComplete: false,
    };
}

/**
 * Starts or resumes the timer.
 */
export function startTimer(state: TimerState): TimerState {
    if (state.isComplete || state.remainingSeconds <= 0) return state;
    return { ...state, isRunning: true, startedAt: Date.now() };
}

/**
 * Pauses the timer, preserving remaining time.
 */
export function pauseTimer(state: TimerState): TimerState {
    if (!state.isRunning || !state.startedAt) return state;
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = Math.max(0, state.remainingSeconds - elapsed);
    return {
        ...state,
        isRunning: false,
        remainingSeconds: remaining,
        startedAt: null,
        isComplete: remaining <= 0,
    };
}

/**
 * Ticks the timer — call this every second from a setInterval.
 * Returns updated state with new remainingSeconds.
 */
export function tickTimer(state: TimerState): TimerState {
    if (!state.isRunning || !state.startedAt) return state;

    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const remaining = Math.max(0, state.totalSeconds - elapsed);

    return {
        ...state,
        remainingSeconds: remaining,
        isComplete: remaining <= 0,
        isRunning: remaining > 0,
    };
}

/**
 * Resets the timer with a new duration.
 */
export function resetTimer(totalSeconds: number): TimerState {
    return createTimer(totalSeconds);
}

/**
 * Formats seconds into MM:SS display string.
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds into a human-readable duration like "2m 30s" or "45s".
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
}

/**
 * Calculates the progress ratio (0 to 1) of the timer.
 * 1 = just started, 0 = complete.
 */
export function getTimerProgress(state: TimerState): number {
    if (state.totalSeconds === 0) return 0;
    return state.remainingSeconds / state.totalSeconds;
}
