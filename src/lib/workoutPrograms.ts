import { EXERCISES, ExerciseCategory, Difficulty, MuscleGroup } from "./repCounter";

// ─── Core Types ────────────────────────────────────────────────────────────

export interface WorkoutExerciseStep {
    exerciseId: string;
    sets: number;
    targetReps: number;
    restSeconds: number; // Rest between sets
}

export interface WorkoutProgram {
    id: string;
    name: string;
    description: string;
    category: ExerciseCategory | "mixed";
    difficulty: Difficulty;
    estimatedMinutes: number;
    targetMuscles: MuscleGroup[];
    warmupSeconds: number;
    cooldownSeconds: number;
    exercises: WorkoutExerciseStep[];
}

// ─── Workout Session State Machine ─────────────────────────────────────────

export type WorkoutPhase = "idle" | "warmup" | "exercise" | "rest" | "cooldown" | "complete";

export interface WorkoutSessionState {
    programId: string;
    phase: WorkoutPhase;
    currentExerciseIndex: number;
    currentSet: number;
    repsCompleted: number;
    /** Total reps across all exercises and sets */
    totalRepsCompleted: number;
    /** Timer countdown in seconds (for warmup, rest, cooldown) */
    timerSeconds: number;
    /** When the current phase started (ms since epoch) */
    phaseStartedAt: number;
    /** Total elapsed seconds since workout started */
    elapsedSeconds: number;
    /** Per-exercise form error counts */
    formErrors: Record<string, number>;
    /** Rep counts per exercise per set: exerciseId -> [set1Reps, set2Reps, ...] */
    setLog: Record<string, number[]>;
}

/**
 * Creates an initial session state for a given program.
 */
export function createWorkoutSession(programId: string): WorkoutSessionState {
    return {
        programId,
        phase: "idle",
        currentExerciseIndex: 0,
        currentSet: 1,
        repsCompleted: 0,
        totalRepsCompleted: 0,
        timerSeconds: 0,
        phaseStartedAt: Date.now(),
        elapsedSeconds: 0,
        formErrors: {},
        setLog: {},
    };
}

/**
 * Starts the workout — enters the warmup phase.
 */
export function startWorkout(state: WorkoutSessionState, program: WorkoutProgram): WorkoutSessionState {
    return {
        ...state,
        phase: program.warmupSeconds > 0 ? "warmup" : "exercise",
        timerSeconds: program.warmupSeconds,
        phaseStartedAt: Date.now(),
    };
}

/**
 * Called when a timer phase (warmup/rest/cooldown) completes.
 */
export function onTimerComplete(state: WorkoutSessionState, program: WorkoutProgram): WorkoutSessionState {
    switch (state.phase) {
        case "warmup":
            return {
                ...state,
                phase: "exercise",
                repsCompleted: 0,
                phaseStartedAt: Date.now(),
            };
        case "rest": {
            const currentStep = program.exercises[state.currentExerciseIndex];
            if (state.currentSet < currentStep.sets) {
                // Next set of same exercise
                return {
                    ...state,
                    phase: "exercise",
                    currentSet: state.currentSet + 1,
                    repsCompleted: 0,
                    phaseStartedAt: Date.now(),
                };
            } else {
                // Move to next exercise
                const nextIndex = state.currentExerciseIndex + 1;
                if (nextIndex >= program.exercises.length) {
                    // All exercises done → cooldown or complete
                    return {
                        ...state,
                        phase: program.cooldownSeconds > 0 ? "cooldown" : "complete",
                        timerSeconds: program.cooldownSeconds,
                        phaseStartedAt: Date.now(),
                    };
                }
                return {
                    ...state,
                    phase: "exercise",
                    currentExerciseIndex: nextIndex,
                    currentSet: 1,
                    repsCompleted: 0,
                    phaseStartedAt: Date.now(),
                };
            }
        }
        case "cooldown":
            return { ...state, phase: "complete", phaseStartedAt: Date.now() };
        default:
            return state;
    }
}

/**
 * Called when a set is completed (user hit target reps or manually finishes).
 */
export function onSetComplete(state: WorkoutSessionState, program: WorkoutProgram): WorkoutSessionState {
    const currentStep = program.exercises[state.currentExerciseIndex];
    const exerciseId = currentStep.exerciseId;

    // Log this set
    const setLog = { ...state.setLog };
    if (!setLog[exerciseId]) setLog[exerciseId] = [];
    setLog[exerciseId].push(state.repsCompleted);

    const totalRepsCompleted = state.totalRepsCompleted + state.repsCompleted;

    const isLastSetOfExercise = state.currentSet >= currentStep.sets;
    const isLastExercise = state.currentExerciseIndex >= program.exercises.length - 1;

    if (isLastSetOfExercise && isLastExercise) {
        // Workout complete
        return {
            ...state,
            setLog,
            totalRepsCompleted,
            phase: program.cooldownSeconds > 0 ? "cooldown" : "complete",
            timerSeconds: program.cooldownSeconds,
            phaseStartedAt: Date.now(),
        };
    }

    // Enter rest phase
    return {
        ...state,
        setLog,
        totalRepsCompleted,
        phase: "rest",
        timerSeconds: currentStep.restSeconds,
        phaseStartedAt: Date.now(),
    };
}

/**
 * Records a form error for the current exercise.
 */
export function recordFormError(state: WorkoutSessionState, exerciseId: string): WorkoutSessionState {
    const formErrors = { ...state.formErrors };
    formErrors[exerciseId] = (formErrors[exerciseId] || 0) + 1;
    return { ...state, formErrors };
}

/**
 * Gets the current exercise config for the active step.
 */
export function getCurrentExercise(state: WorkoutSessionState, program: WorkoutProgram) {
    const step = program.exercises[state.currentExerciseIndex];
    if (!step) return null;
    return EXERCISES[step.exerciseId] || null;
}

/**
 * Gets a summary of the workout session for saving to the backend.
 */
export function getWorkoutSummary(state: WorkoutSessionState, program: WorkoutProgram) {
    const totalFormErrors = Object.values(state.formErrors).reduce((a, b) => a + b, 0);
    const qualityScore = Math.max(0, 100 - totalFormErrors * 2);

    return {
        programId: program.id,
        programName: program.name,
        totalReps: state.totalRepsCompleted,
        qualityScore,
        durationSeconds: state.elapsedSeconds,
        exerciseBreakdown: state.setLog,
        formErrors: state.formErrors,
    };
}


// ─── Pre-Built Workout Programs ────────────────────────────────────────────

export const WORKOUT_PROGRAMS: Record<string, WorkoutProgram> = {

    // ── BEGINNER ───────────────────────────────────────────────────────────

    beginner_full_body: {
        id: "beginner_full_body",
        name: "Beginner Full Body",
        description: "A balanced full-body workout perfect for getting started. Covers all major muscle groups with simple movements.",
        category: "mixed",
        difficulty: "beginner",
        estimatedMinutes: 15,
        targetMuscles: ["chest", "quads", "glutes", "biceps", "abs"],
        warmupSeconds: 30,
        cooldownSeconds: 30,
        exercises: [
            { exerciseId: "jumping_jack", sets: 2, targetReps: 15, restSeconds: 30 },
            { exerciseId: "squat", sets: 3, targetReps: 12, restSeconds: 45 },
            { exerciseId: "pushup", sets: 3, targetReps: 10, restSeconds: 45 },
            { exerciseId: "curl", sets: 2, targetReps: 12, restSeconds: 30 },
            { exerciseId: "crunch", sets: 2, targetReps: 15, restSeconds: 30 },
        ],
    },

    upper_body_blast: {
        id: "upper_body_blast",
        name: "Upper Body Blast",
        description: "Target your arms and shoulders with this focused upper body session.",
        category: "upper-body",
        difficulty: "beginner",
        estimatedMinutes: 12,
        targetMuscles: ["biceps", "triceps", "shoulders", "chest"],
        warmupSeconds: 30,
        cooldownSeconds: 20,
        exercises: [
            { exerciseId: "curl", sets: 3, targetReps: 12, restSeconds: 30 },
            { exerciseId: "overhead_press", sets: 3, targetReps: 10, restSeconds: 45 },
            { exerciseId: "tricep_extension", sets: 3, targetReps: 12, restSeconds: 30 },
            { exerciseId: "lateral_raise", sets: 2, targetReps: 12, restSeconds: 30 },
            { exerciseId: "pushup", sets: 3, targetReps: 10, restSeconds: 45 },
        ],
    },

    leg_day: {
        id: "leg_day",
        name: "Leg Day",
        description: "Never skip leg day. Squats, lunges, and calf raises to build a solid foundation.",
        category: "lower-body",
        difficulty: "beginner",
        estimatedMinutes: 12,
        targetMuscles: ["quads", "glutes", "hamstrings", "calves"],
        warmupSeconds: 30,
        cooldownSeconds: 30,
        exercises: [
            { exerciseId: "high_knee", sets: 2, targetReps: 20, restSeconds: 30 },
            { exerciseId: "squat", sets: 4, targetReps: 15, restSeconds: 60 },
            { exerciseId: "lunge", sets: 3, targetReps: 10, restSeconds: 45 },
            { exerciseId: "calf_raise", sets: 3, targetReps: 20, restSeconds: 30 },
        ],
    },

    core_crusher: {
        id: "core_crusher",
        name: "Core Crusher",
        description: "Intense core workout to build abs and oblique strength.",
        category: "core",
        difficulty: "intermediate",
        estimatedMinutes: 10,
        targetMuscles: ["abs", "obliques"],
        warmupSeconds: 20,
        cooldownSeconds: 20,
        exercises: [
            { exerciseId: "crunch", sets: 4, targetReps: 20, restSeconds: 30 },
            { exerciseId: "leg_raise", sets: 3, targetReps: 15, restSeconds: 45 },
            { exerciseId: "high_knee", sets: 2, targetReps: 30, restSeconds: 30 },
        ],
    },

    // ── INTERMEDIATE ───────────────────────────────────────────────────────

    intermediate_push_pull: {
        id: "intermediate_push_pull",
        name: "Push Pull Power",
        description: "A balanced push-pull workout targeting opposing muscle groups for maximum efficiency.",
        category: "mixed",
        difficulty: "intermediate",
        estimatedMinutes: 25,
        targetMuscles: ["chest", "triceps", "shoulders", "biceps", "quads"],
        warmupSeconds: 45,
        cooldownSeconds: 30,
        exercises: [
            { exerciseId: "jumping_jack", sets: 2, targetReps: 20, restSeconds: 20 },
            { exerciseId: "pushup", sets: 4, targetReps: 15, restSeconds: 60 },
            { exerciseId: "curl", sets: 3, targetReps: 12, restSeconds: 45 },
            { exerciseId: "overhead_press", sets: 3, targetReps: 12, restSeconds: 60 },
            { exerciseId: "tricep_extension", sets: 3, targetReps: 12, restSeconds: 45 },
            { exerciseId: "squat", sets: 4, targetReps: 15, restSeconds: 60 },
            { exerciseId: "crunch", sets: 3, targetReps: 20, restSeconds: 30 },
        ],
    },

    hiit_burner: {
        id: "hiit_burner",
        name: "HIIT Fat Burner",
        description: "High-intensity interval training — short rests, max effort. Burns calories long after you finish.",
        category: "mixed",
        difficulty: "intermediate",
        estimatedMinutes: 18,
        targetMuscles: ["full-body", "abs", "quads", "calves"],
        warmupSeconds: 30,
        cooldownSeconds: 30,
        exercises: [
            { exerciseId: "jumping_jack", sets: 3, targetReps: 25, restSeconds: 15 },
            { exerciseId: "high_knee", sets: 3, targetReps: 25, restSeconds: 15 },
            { exerciseId: "squat", sets: 3, targetReps: 20, restSeconds: 20 },
            { exerciseId: "pushup", sets: 3, targetReps: 15, restSeconds: 20 },
            { exerciseId: "lunge", sets: 3, targetReps: 12, restSeconds: 20 },
            { exerciseId: "crunch", sets: 3, targetReps: 20, restSeconds: 15 },
        ],
    },

    // ── ADVANCED ────────────────────────────────────────────────────────────

    advanced_total_body: {
        id: "advanced_total_body",
        name: "Total Body Destroyer",
        description: "A brutal full-body workout for experienced athletes. High volume, short rest. Not for the faint of heart.",
        category: "mixed",
        difficulty: "advanced",
        estimatedMinutes: 35,
        targetMuscles: ["chest", "biceps", "triceps", "shoulders", "quads", "glutes", "abs", "calves"],
        warmupSeconds: 60,
        cooldownSeconds: 45,
        exercises: [
            { exerciseId: "jumping_jack", sets: 3, targetReps: 30, restSeconds: 15 },
            { exerciseId: "pushup", sets: 5, targetReps: 20, restSeconds: 45 },
            { exerciseId: "squat", sets: 5, targetReps: 20, restSeconds: 45 },
            { exerciseId: "overhead_press", sets: 4, targetReps: 15, restSeconds: 45 },
            { exerciseId: "lunge", sets: 4, targetReps: 15, restSeconds: 45 },
            { exerciseId: "curl", sets: 4, targetReps: 15, restSeconds: 30 },
            { exerciseId: "tricep_extension", sets: 4, targetReps: 15, restSeconds: 30 },
            { exerciseId: "lateral_raise", sets: 3, targetReps: 15, restSeconds: 30 },
            { exerciseId: "calf_raise", sets: 3, targetReps: 25, restSeconds: 30 },
            { exerciseId: "leg_raise", sets: 4, targetReps: 20, restSeconds: 30 },
            { exerciseId: "crunch", sets: 4, targetReps: 25, restSeconds: 20 },
            { exerciseId: "high_knee", sets: 3, targetReps: 30, restSeconds: 15 },
        ],
    },

    arm_annihilator: {
        id: "arm_annihilator",
        name: "Arm Annihilator",
        description: "Devoted arm day: biceps, triceps, and shoulders pushed to the limit.",
        category: "upper-body",
        difficulty: "advanced",
        estimatedMinutes: 20,
        targetMuscles: ["biceps", "triceps", "shoulders"],
        warmupSeconds: 30,
        cooldownSeconds: 20,
        exercises: [
            { exerciseId: "curl", sets: 5, targetReps: 15, restSeconds: 30 },
            { exerciseId: "tricep_extension", sets: 5, targetReps: 15, restSeconds: 30 },
            { exerciseId: "overhead_press", sets: 4, targetReps: 12, restSeconds: 45 },
            { exerciseId: "lateral_raise", sets: 4, targetReps: 15, restSeconds: 30 },
            { exerciseId: "pushup", sets: 3, targetReps: 20, restSeconds: 45 },
        ],
    },
};

/** All program IDs */
export const PROGRAM_IDS = Object.keys(WORKOUT_PROGRAMS);

/** Programs grouped by difficulty */
export const PROGRAMS_BY_DIFFICULTY: Record<Difficulty, WorkoutProgram[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
};
for (const prog of Object.values(WORKOUT_PROGRAMS)) {
    PROGRAMS_BY_DIFFICULTY[prog.difficulty].push(prog);
}
