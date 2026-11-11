/**
 * UNIT TESTS — Workout program state machine and program catalogue
 *
 * Why: a guided workout moves through idle → warmup → exercise ⇄ rest →
 * cooldown → complete. Each transition is a pure function, so the whole flow
 * can be walked deterministically. The catalogue is checked so that no program
 * references an exercise that doesn't exist (which would crash the UI).
 */
import { EXERCISES } from "./repCounter";
import {
    PROGRAMS_BY_DIFFICULTY,
    PROGRAM_IDS,
    WORKOUT_PROGRAMS,
    WorkoutProgram,
    createWorkoutSession,
    getCurrentExercise,
    getWorkoutSummary,
    onSetComplete,
    onTimerComplete,
    recordFormError,
    startWorkout,
} from "./workoutPrograms";

const mini: WorkoutProgram = {
    id: "mini",
    name: "Mini",
    description: "test program",
    category: "mixed",
    difficulty: "beginner",
    estimatedMinutes: 1,
    targetMuscles: ["biceps"],
    warmupSeconds: 10,
    cooldownSeconds: 5,
    exercises: [
        { exerciseId: "curl", sets: 2, targetReps: 5, restSeconds: 20 },
        { exerciseId: "squat", sets: 1, targetReps: 8, restSeconds: 30 },
    ],
};

describe("program catalogue", () => {
    test.each(PROGRAM_IDS)("%s only references existing exercises and has valid numbers", (id) => {
        const p = WORKOUT_PROGRAMS[id];
        expect(p.id).toBe(id);
        expect(p.exercises.length).toBeGreaterThan(0);
        for (const step of p.exercises) {
            expect(EXERCISES[step.exerciseId]).toBeDefined();
            expect(step.sets).toBeGreaterThan(0);
            expect(step.targetReps).toBeGreaterThan(0);
            expect(step.restSeconds).toBeGreaterThanOrEqual(0);
        }
        expect(p.warmupSeconds).toBeGreaterThanOrEqual(0);
        expect(p.cooldownSeconds).toBeGreaterThanOrEqual(0);
    });

    test("difficulty index covers every program once", () => {
        expect(Object.values(PROGRAMS_BY_DIFFICULTY).flat().map((p) => p.id).sort()).toEqual([...PROGRAM_IDS].sort());
    });
});

describe("workout session state machine", () => {
    test("a new session is idle at the first exercise", () => {
        expect(createWorkoutSession("mini")).toMatchObject({
            programId: "mini", phase: "idle", currentExerciseIndex: 0, currentSet: 1, totalRepsCompleted: 0,
        });
    });

    test("starting goes to warmup, or straight to exercise when there is no warmup", () => {
        expect(startWorkout(createWorkoutSession("mini"), mini)).toMatchObject({ phase: "warmup", timerSeconds: 10 });
        expect(startWorkout(createWorkoutSession("mini"), { ...mini, warmupSeconds: 0 }).phase).toBe("exercise");
    });

    test("full walk-through of a program", () => {
        let s = startWorkout(createWorkoutSession("mini"), mini);
        s = onTimerComplete(s, mini); // warmup done
        expect(s).toMatchObject({ phase: "exercise", currentExerciseIndex: 0, currentSet: 1 });
        expect(getCurrentExercise(s, mini)?.id).toBe("curl");

        s = onSetComplete({ ...s, repsCompleted: 5 }, mini); // curl set 1
        expect(s).toMatchObject({ phase: "rest", timerSeconds: 20, totalRepsCompleted: 5 });

        s = onTimerComplete(s, mini); // rest → curl set 2
        expect(s).toMatchObject({ phase: "exercise", currentSet: 2, repsCompleted: 0 });

        s = onSetComplete({ ...s, repsCompleted: 4 }, mini); // curl set 2 (last of curl)
        expect(s.phase).toBe("rest");
        s = onTimerComplete(s, mini); // → squat
        expect(s).toMatchObject({ phase: "exercise", currentExerciseIndex: 1, currentSet: 1 });
        expect(getCurrentExercise(s, mini)?.id).toBe("squat");

        s = onSetComplete({ ...s, repsCompleted: 8 }, mini); // last set of last exercise
        expect(s).toMatchObject({ phase: "cooldown", timerSeconds: 5, totalRepsCompleted: 17 });
        expect(s.setLog).toEqual({ curl: [5, 4], squat: [8] });

        s = onTimerComplete(s, mini);
        expect(s.phase).toBe("complete");
        expect(onTimerComplete(s, mini)).toBe(s); // terminal state
    });

    test("finishing goes straight to complete when there is no cooldown", () => {
        const noCool = { ...mini, cooldownSeconds: 0, exercises: [mini.exercises[1]] };
        let s = startWorkout(createWorkoutSession("x"), { ...noCool, warmupSeconds: 0 });
        s = onSetComplete({ ...s, repsCompleted: 8 }, noCool);
        expect(s.phase).toBe("complete");
    });

    test("state transitions do not mutate the previous state", () => {
        const s = { ...createWorkoutSession("mini"), phase: "exercise" as const, repsCompleted: 3 };
        const snapshot = JSON.stringify(s);
        onSetComplete(s, mini);
        recordFormError(s, "curl");
        expect(JSON.stringify(s)).toBe(snapshot);
    });

    test("getCurrentExercise returns null past the end", () => {
        expect(getCurrentExercise({ ...createWorkoutSession("mini"), currentExerciseIndex: 9 }, mini)).toBeNull();
    });
});

describe("summary", () => {
    test("quality is 100 minus 2 per form error, floored at 0", () => {
        let s = { ...createWorkoutSession("mini"), totalRepsCompleted: 17, elapsedSeconds: 300 };
        s = recordFormError(recordFormError(recordFormError(s, "curl"), "curl"), "squat");
        expect(getWorkoutSummary(s, mini)).toMatchObject({
            programId: "mini", programName: "Mini", totalReps: 17, qualityScore: 94, durationSeconds: 300,
            formErrors: { curl: 2, squat: 1 },
        });
        expect(getWorkoutSummary({ ...s, formErrors: { curl: 80 } }, mini).qualityScore).toBe(0);
    });

    test("summary payload matches what POST /api/workout-logs expects", () => {
        const keys = Object.keys(getWorkoutSummary(createWorkoutSession("mini"), mini)).sort();
        expect(keys).toEqual(["durationSeconds", "exerciseBreakdown", "formErrors", "programId", "programName", "qualityScore", "totalReps"]);
    });
});
