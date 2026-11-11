/**
 * UNIT TESTS — Rep counter state machine and exercise registry
 *
 * Why: rep counting is the core feature. updateExercise() is a state machine
 * fed ~30 noisy frames per second; off-by-one errors, missing hysteresis, or a
 * mis-configured threshold would double-count or never count reps. These tests
 * replay synthetic angle sequences and check counts, progress and form feedback.
 */
import {
    EXERCISES,
    EXERCISES_BY_CATEGORY,
    EXERCISES_BY_DIFFICULTY,
    EXERCISE_IDS,
    ExerciseConfig,
    ExerciseState,
    updateExercise,
} from "./repCounter";
import { lm, standingJoints } from "./__fixtures__/pose";

/** Feeds a sequence of angles through the state machine and returns the final result. */
function replay(config: ExerciseConfig, angles: number[], joints = standingJoints()) {
    let state: ExerciseState = "down";
    let count = 0;
    const feedback: (string | undefined)[] = [];
    for (const angle of angles) {
        const r = updateExercise(joints, angle, state, count, config);
        state = r.newState;
        count = r.newCount;
        feedback.push(r.feedback);
    }
    return { state, count, feedback };
}

describe("exercise registry integrity", () => {
    test("exposes the 12 exercises advertised in the README", () => {
        expect(EXERCISE_IDS.sort()).toEqual(
            [
                "calf_raise", "crunch", "curl", "high_knee", "jumping_jack", "lateral_raise",
                "leg_raise", "lunge", "overhead_press", "pushup", "squat", "tricep_extension",
            ].sort()
        );
    });

    test.each(EXERCISE_IDS)("%s has a consistent, usable config", (id) => {
        const ex = EXERCISES[id];
        expect(ex.id).toBe(id);
        expect(ex.thresholds.up).not.toBe(ex.thresholds.down);
        // Hysteresis band must be wider than the 2 x 12 degree tolerance or reps can never complete
        expect(Math.abs(ex.thresholds.up - ex.thresholds.down)).toBeGreaterThan(24);
        for (const t of [ex.thresholds.up, ex.thresholds.down]) {
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThanOrEqual(180);
        }
        expect(ex.requiredJoints.length).toBeGreaterThan(0);
        expect(new Set(ex.formRules.map((r) => r.id)).size).toBe(ex.formRules.length);
        // getAngle must work on a real skeleton and return a valid angle
        const angle = ex.getAngle(standingJoints());
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThanOrEqual(180);
    });

    test("category and difficulty indexes contain every exercise exactly once", () => {
        const byCat = Object.values(EXERCISES_BY_CATEGORY).flat().map((e) => e.id).sort();
        const byDiff = Object.values(EXERCISES_BY_DIFFICULTY).flat().map((e) => e.id).sort();
        expect(byCat).toEqual([...EXERCISE_IDS].sort());
        expect(byDiff).toEqual([...EXERCISE_IDS].sort());
    });
});

describe("updateExercise — standard direction (curl: up=30, down=160)", () => {
    const curl = EXERCISES.curl;

    test("counts one rep for a full down -> up -> down cycle", () => {
        expect(replay(curl, [170, 120, 80, 40, 25, 60, 120, 165]).count).toBe(1);
    });

    test("counts multiple reps", () => {
        const oneRep = [165, 100, 30, 100, 165];
        expect(replay(curl, [...oneRep, ...oneRep, ...oneRep]).count).toBe(3);
    });

    test("does not count a partial rep that never reaches the top", () => {
        expect(replay(curl, [165, 120, 60, 120, 165]).count).toBe(0);
    });

    test("hysteresis: jitter around a threshold does not double count", () => {
        const jitter = [165, 41, 43, 41, 43, 41, 149, 147, 149, 147];
        expect(replay(curl, jitter).count).toBe(1);
    });

    test("applies the 12 degree tolerance at both ends", () => {
        // upTrigger = 42, downTrigger = 148
        expect(updateExercise(standingJoints(), 41, "down", 0, curl).newState).toBe("up");
        expect(updateExercise(standingJoints(), 42, "down", 0, curl).newState).toBe("down");
        expect(updateExercise(standingJoints(), 149, "up", 0, curl)).toMatchObject({ newState: "down", newCount: 1 });
        expect(updateExercise(standingJoints(), 148, "up", 0, curl)).toMatchObject({ newState: "up", newCount: 0 });
    });

    test("progress is 0 at the bottom, 1 at the top, clamped outside", () => {
        const j = standingJoints();
        expect(updateExercise(j, 160, "down", 0, curl).progress).toBe(0);
        expect(updateExercise(j, 30, "down", 0, curl).progress).toBe(1);
        expect(updateExercise(j, 95, "down", 0, curl).progress).toBeCloseTo(0.5);
        expect(updateExercise(j, 10, "down", 0, curl).progress).toBe(1);
    });

    // KNOWN DEFECT (minor, visible in the UI progress bar): progress is computed
    // as |down - angle| / range, so moving *beyond* the "down" end (e.g. a fully
    // straight arm at 179 deg when down = 160) makes progress rise again (~15%).
    test.failing("progress stays at 0 when moving past the 'down' endpoint", () => {
        expect(updateExercise(standingJoints(), 179, "down", 0, curl).progress).toBe(0);
    });
});

describe("updateExercise — reversed direction (overhead press: up=170, down=90)", () => {
    const press = EXERCISES.overhead_press;

    test("counts a rep when the arm goes up past 158 and back below 102", () => {
        expect(replay(press, [85, 120, 160, 175, 130, 100]).count).toBe(1);
    });

    test("does not count when the press never locks out", () => {
        expect(replay(press, [85, 120, 150, 120, 90]).count).toBe(0);
    });
});

describe("form feedback", () => {
    const curl = EXERCISES.curl;

    test("no feedback for clean form", () => {
        const r = updateExercise(standingJoints(), 165, "down", 0, curl);
        expect(r.feedback).toBeUndefined();
        expect(r.feedbackSeverity).toBeUndefined();
    });

    test("warnings fire only near a rep endpoint", () => {
        // "Curl higher!" applies when state is up and 35 < angle < 60
        const nearTop = updateExercise(standingJoints(), 40, "up", 0, curl); // progress 0.92
        expect(nearTop).toMatchObject({ feedback: "Curl higher!", feedbackSeverity: "warning" });

        const midRange = updateExercise(standingJoints(), 55, "up", 0, curl); // progress 0.81
        expect(midRange.feedback).toBeUndefined();
    });

    test("errors fire at any point of the movement (curl body swing)", () => {
        const swinging = standingJoints({ leftShoulder: lm(0.8, 0.35), rightShoulder: lm(0.6, 0.35) });
        const r = updateExercise(swinging, 95, "down", 0, curl);
        expect(r).toMatchObject({ feedback: "Stop swinging! Pin elbows!", feedbackSeverity: "error" });
    });

    test("squat knee cave is detected", () => {
        const caved = standingJoints({ rightKnee: lm(0.5, 0.75), rightAnkle: lm(0.42, 0.9) });
        const r = updateExercise(caved, 120, "down", 0, EXERCISES.squat);
        expect(r.feedback).toBe("Knees out! Don't cave in!");
    });

    test("push-up hip sag and pike are detected", () => {
        // Plank: shoulder and ankle at y=0.5 → midline 0.5
        const plank = (hipY: number) =>
            standingJoints({ rightShoulder: lm(0.2, 0.5), rightHip: lm(0.5, hipY), rightAnkle: lm(0.8, 0.5) });
        expect(updateExercise(plank(0.5), 160, "down", 0, EXERCISES.pushup).feedback).toBeUndefined();
        expect(updateExercise(plank(0.6), 160, "down", 0, EXERCISES.pushup).feedback).toBe("Don't sag hips! Tighten core!");
        expect(updateExercise(plank(0.4), 160, "down", 0, EXERCISES.pushup).feedback).toBe("Don't pike — straighten body!");
    });

    test("form feedback does not block rep counting", () => {
        const swinging = standingJoints({ leftShoulder: lm(0.8, 0.35), rightShoulder: lm(0.6, 0.35) });
        expect(replay(curl, [165, 30, 165], swinging).count).toBe(1);
    });
});

describe("angle extraction from a skeleton", () => {
    test("a straight standing leg reads ~180 degrees at the knee (squat)", () => {
        expect(EXERCISES.squat.getAngle(standingJoints())).toBe(180);
    });

    test("a deep squat reads below the 'up' threshold", () => {
        const squatting = standingJoints({
            rightHip: lm(0.3, 0.7),
            rightKnee: lm(0.42, 0.72),
            rightAnkle: lm(0.42, 0.9),
        });
        expect(EXERCISES.squat.getAngle(squatting)).toBeLessThan(EXERCISES.squat.thresholds.up + 12);
    });
});
