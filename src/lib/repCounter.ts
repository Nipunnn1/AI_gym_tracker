import { KeyJoints, calculateAngle, getTorsoLean, getVerticalAlignment, getMidpoint, areJointsVisible } from "./biomechanics";

// ─── Core Types ────────────────────────────────────────────────────────────

export type ExerciseState = "down" | "up";

export interface ExerciseResult {
    newState: ExerciseState;
    newCount: number;
    progress: number;
    feedback?: string;
    feedbackSeverity?: "warning" | "error";
}

export interface FormRule {
    id: string;
    message: string;
    severity: "warning" | "error";
    check: (joints: KeyJoints, angle: number, state: ExerciseState) => boolean;
}

export type ExerciseCategory = "upper-body" | "lower-body" | "core" | "full-body";
export type MuscleGroup =
    | "biceps" | "triceps" | "shoulders" | "chest" | "back" | "lats"
    | "quads" | "hamstrings" | "glutes" | "calves"
    | "abs" | "obliques"
    | "full-body";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface ExerciseConfig {
    id: string;
    name: string;
    category: ExerciseCategory;
    primaryMuscles: MuscleGroup[];
    secondaryMuscles: MuscleGroup[];
    difficulty: Difficulty;
    description: string;
    tips: string[];
    type: "angle";
    /** Which side of the body to analyze. "both" averages both sides. */
    side: "left" | "right" | "both";
    /** The joint to display the angle overlay on (per side) */
    displayJoint: (joints: KeyJoints) => { x: number; y: number };
    getAngle: (joints: KeyJoints) => number;
    /** Optional: get the angle for the other side (for symmetry tracking) */
    getAngleLeft?: (joints: KeyJoints) => number;
    getAngleRight?: (joints: KeyJoints) => number;
    thresholds: {
        up: number;
        down: number;
    };
    /** Required joints that must be visible for this exercise to track properly */
    requiredJoints: (keyof KeyJoints)[];
    formRules: FormRule[];
}

// ─── Exercise Registry ─────────────────────────────────────────────────────

export const EXERCISES: Record<string, ExerciseConfig> = {

    // ═══════════════════════════════════════════════════════════════════════
    // UPPER BODY
    // ═══════════════════════════════════════════════════════════════════════

    curl: {
        id: "curl",
        name: "Bicep Curl",
        category: "upper-body",
        primaryMuscles: ["biceps"],
        secondaryMuscles: ["shoulders"],
        difficulty: "beginner",
        description: "Classic bicep isolation exercise. Keep elbows pinned to your sides.",
        tips: [
            "Don't swing your body — use strict form",
            "Squeeze at the top of the movement",
            "Control the negative (lowering) phase",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightElbow,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
        getAngleLeft: (joints) => calculateAngle(joints.leftShoulder, joints.leftElbow, joints.leftWrist),
        getAngleRight: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
        thresholds: { up: 30, down: 160 },
        requiredJoints: ["rightShoulder", "rightElbow", "rightWrist"],
        formRules: [
            {
                id: "partial-curl",
                message: "Curl higher!",
                severity: "warning",
                check: (_joints, angle, state) => state === "up" && angle > 35 && angle < 60,
            },
            {
                id: "partial-extend",
                message: "Extend fully!",
                severity: "warning",
                check: (_joints, angle, state) => state === "down" && angle > 130 && angle < 155,
            },
            {
                id: "body-swing",
                message: "Stop swinging! Pin elbows!",
                severity: "error",
                check: (joints, _angle, _state) => getTorsoLean(joints) > 20,
            },
        ],
    },

    overhead_press: {
        id: "overhead_press",
        name: "Overhead Press",
        category: "upper-body",
        primaryMuscles: ["shoulders"],
        secondaryMuscles: ["triceps"],
        difficulty: "intermediate",
        description: "Press the weight overhead from shoulder height to full lockout.",
        tips: [
            "Keep your core tight — don't lean back",
            "Press straight up, not forward",
            "Lock out fully at the top",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightShoulder,
        getAngle: (joints) => calculateAngle(joints.rightHip, joints.rightShoulder, joints.rightElbow),
        getAngleLeft: (joints) => calculateAngle(joints.leftHip, joints.leftShoulder, joints.leftElbow),
        getAngleRight: (joints) => calculateAngle(joints.rightHip, joints.rightShoulder, joints.rightElbow),
        thresholds: { up: 170, down: 90 },
        requiredJoints: ["rightShoulder", "rightElbow", "rightHip"],
        formRules: [
            {
                id: "lean-back",
                message: "Don't lean back!",
                severity: "error",
                check: (joints) => getTorsoLean(joints) > 15,
            },
            {
                id: "partial-lockout",
                message: "Lock out at the top!",
                severity: "warning",
                check: (_joints, angle, state) => state === "up" && angle > 150 && angle < 165,
            },
        ],
    },

    lateral_raise: {
        id: "lateral_raise",
        name: "Lateral Raise",
        category: "upper-body",
        primaryMuscles: ["shoulders"],
        secondaryMuscles: [],
        difficulty: "beginner",
        description: "Raise arms out to the sides to shoulder height for deltoid isolation.",
        tips: [
            "Slight bend in elbows throughout",
            "Don't go above shoulder height",
            "Control the lowering phase",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightShoulder,
        getAngle: (joints) => {
            const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
            return calculateAngle(hipMid, joints.rightShoulder, joints.rightWrist);
        },
        getAngleLeft: (joints) => {
            const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
            return calculateAngle(hipMid, joints.leftShoulder, joints.leftWrist);
        },
        getAngleRight: (joints) => {
            const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
            return calculateAngle(hipMid, joints.rightShoulder, joints.rightWrist);
        },
        thresholds: { up: 85, down: 15 },
        requiredJoints: ["rightShoulder", "rightWrist", "leftHip", "rightHip"],
        formRules: [
            {
                id: "too-high",
                message: "Don't raise above shoulders!",
                severity: "warning",
                check: (_joints, angle) => angle > 100,
            },
            {
                id: "momentum",
                message: "Slow down — no momentum!",
                severity: "error",
                check: (joints) => getTorsoLean(joints) > 12,
            },
        ],
    },

    tricep_extension: {
        id: "tricep_extension",
        name: "Tricep Extension",
        category: "upper-body",
        primaryMuscles: ["triceps"],
        secondaryMuscles: [],
        difficulty: "beginner",
        description: "Overhead tricep extension: keep upper arm fixed, only move the forearm behind your head.",
        tips: [
            "Keep upper arms close to ears",
            "Full extension at the top",
            "Don't flare elbows out",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightElbow,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
        getAngleLeft: (joints) => calculateAngle(joints.leftShoulder, joints.leftElbow, joints.leftWrist),
        getAngleRight: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
        thresholds: { up: 170, down: 50 },
        requiredJoints: ["rightShoulder", "rightElbow", "rightWrist"],
        formRules: [
            {
                id: "elbow-drift",
                message: "Keep elbows by ears!",
                severity: "error",
                check: (joints) => {
                    // Check if elbow has drifted far from the shoulder in X
                    return Math.abs(joints.rightElbow.x - joints.rightShoulder.x) > 0.12;
                },
            },
            {
                id: "partial-extension",
                message: "Extend fully!",
                severity: "warning",
                check: (_joints, angle, state) => state === "up" && angle > 150 && angle < 165,
            },
        ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // LOWER BODY
    // ═══════════════════════════════════════════════════════════════════════

    squat: {
        id: "squat",
        name: "Squat",
        category: "lower-body",
        primaryMuscles: ["quads", "glutes"],
        secondaryMuscles: ["hamstrings", "calves"],
        difficulty: "beginner",
        description: "The king of lower body exercises. Sit back and down with weight on heels.",
        tips: [
            "Keep knees tracking over toes",
            "Chest up, back neutral",
            "Hit parallel or below",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightKnee,
        getAngle: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
        getAngleLeft: (joints) => calculateAngle(joints.leftHip, joints.leftKnee, joints.leftAnkle),
        getAngleRight: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
        thresholds: { up: 90, down: 160 },
        requiredJoints: ["rightHip", "rightKnee", "rightAnkle"],
        formRules: [
            {
                id: "depth",
                message: "Go lower — hit parallel!",
                severity: "warning",
                check: (_joints, angle, state) => state === "down" && angle < 115 && angle > 95,
            },
            {
                id: "knee-cave",
                message: "Knees out! Don't cave in!",
                severity: "error",
                check: (joints) => {
                    // Detect knee valgus: knee is more inward than the ankle
                    return joints.rightKnee.x > joints.rightAnkle.x + 0.04;
                },
            },
            {
                id: "forward-lean",
                message: "Chest up! Don't lean forward!",
                severity: "error",
                check: (joints) => getTorsoLean(joints) > 35,
            },
        ],
    },

    lunge: {
        id: "lunge",
        name: "Lunge",
        category: "lower-body",
        primaryMuscles: ["quads", "glutes"],
        secondaryMuscles: ["hamstrings", "calves"],
        difficulty: "intermediate",
        description: "Step forward and lower until both knees are at 90 degrees.",
        tips: [
            "Keep front knee behind toes",
            "Back knee should almost touch ground",
            "Torso stays upright",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightKnee,
        getAngle: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
        getAngleLeft: (joints) => calculateAngle(joints.leftHip, joints.leftKnee, joints.leftAnkle),
        getAngleRight: (joints) => calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle),
        thresholds: { up: 90, down: 165 },
        requiredJoints: ["rightHip", "rightKnee", "rightAnkle", "leftKnee"],
        formRules: [
            {
                id: "shallow-lunge",
                message: "Go deeper — 90° at the knee!",
                severity: "warning",
                check: (_joints, angle, state) => state === "down" && angle < 120 && angle > 95,
            },
            {
                id: "torso-lean",
                message: "Stay upright! Don't lean!",
                severity: "error",
                check: (joints) => getTorsoLean(joints) > 25,
            },
        ],
    },

    calf_raise: {
        id: "calf_raise",
        name: "Calf Raise",
        category: "lower-body",
        primaryMuscles: ["calves"],
        secondaryMuscles: [],
        difficulty: "beginner",
        description: "Rise onto your toes, squeezing calves at the top. Slow and controlled.",
        tips: [
            "Full range of motion — stretch at the bottom",
            "Pause at the top for 1 second",
            "Keep legs straight, don't bend knees",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightAnkle,
        getAngle: (joints) => calculateAngle(joints.rightKnee, joints.rightAnkle, joints.rightFootIndex),
        getAngleLeft: (joints) => calculateAngle(joints.leftKnee, joints.leftAnkle, joints.leftFootIndex),
        getAngleRight: (joints) => calculateAngle(joints.rightKnee, joints.rightAnkle, joints.rightFootIndex),
        thresholds: { up: 140, down: 85 },
        requiredJoints: ["rightKnee", "rightAnkle", "rightFootIndex"],
        formRules: [
            {
                id: "bent-knees",
                message: "Keep legs straight!",
                severity: "error",
                check: (joints) => {
                    const kneeAngle = calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle);
                    return kneeAngle < 160;
                },
            },
        ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CORE
    // ═══════════════════════════════════════════════════════════════════════

    crunch: {
        id: "crunch",
        name: "Crunch",
        category: "core",
        primaryMuscles: ["abs"],
        secondaryMuscles: ["obliques"],
        difficulty: "beginner",
        description: "Lie on your back, curl your torso up toward your knees. Focus on the contraction.",
        tips: [
            "Don't pull with your neck — use abs",
            "Exhale on the way up",
            "Slow and controlled — no momentum",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightHip,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightHip, joints.rightKnee),
        thresholds: { up: 60, down: 120 },
        requiredJoints: ["rightShoulder", "rightHip", "rightKnee"],
        formRules: [
            {
                id: "neck-strain",
                message: "Don't pull your neck!",
                severity: "error",
                check: (joints) => {
                    // If nose is way ahead of shoulders, user is yanking neck forward
                    return joints.nose.y < joints.rightShoulder.y - 0.08;
                },
            },
        ],
    },

    leg_raise: {
        id: "leg_raise",
        name: "Leg Raise",
        category: "core",
        primaryMuscles: ["abs"],
        secondaryMuscles: ["obliques"],
        difficulty: "intermediate",
        description: "Lie flat on your back and raise straightened legs up to 90 degrees.",
        tips: [
            "Keep lower back pressed into the ground",
            "Don't bend your knees",
            "Lower slowly — don't drop your legs",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightHip,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightHip, joints.rightAnkle),
        thresholds: { up: 80, down: 160 },
        requiredJoints: ["rightShoulder", "rightHip", "rightAnkle", "rightKnee"],
        formRules: [
            {
                id: "bent-legs",
                message: "Keep legs straight!",
                severity: "error",
                check: (joints) => {
                    const kneeAngle = calculateAngle(joints.rightHip, joints.rightKnee, joints.rightAnkle);
                    return kneeAngle < 150;
                },
            },
            {
                id: "back-arch",
                message: "Press lower back down!",
                severity: "error",
                check: (joints) => {
                    // If hip lifts off: hip y becomes significantly less than heel y
                    return joints.rightHip.y < joints.rightHeel.y - 0.05;
                },
            },
        ],
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FULL BODY
    // ═══════════════════════════════════════════════════════════════════════

    pushup: {
        id: "pushup",
        name: "Push-Up",
        category: "full-body",
        primaryMuscles: ["chest", "triceps"],
        secondaryMuscles: ["shoulders", "abs"],
        difficulty: "beginner",
        description: "The classic bodyweight pressing movement. Chest to floor, then press up.",
        tips: [
            "Keep body in a straight line — don't sag hips",
            "Elbows at 45° angle, not flared",
            "Full lockout at the top",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightElbow,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightElbow, joints.rightWrist),
        thresholds: { up: 60, down: 160 },
        requiredJoints: ["rightShoulder", "rightElbow", "rightWrist", "rightHip", "rightAnkle"],
        formRules: [
            {
                id: "hip-sag",
                message: "Don't sag hips! Tighten core!",
                severity: "error",
                check: (joints) => {
                    // If hips drop below the shoulder-ankle line significantly
                    const shoulderAnkleMidY = (joints.rightShoulder.y + joints.rightAnkle.y) / 2;
                    return joints.rightHip.y > shoulderAnkleMidY + 0.06;
                },
            },
            {
                id: "hip-pike",
                message: "Don't pike — straighten body!",
                severity: "error",
                check: (joints) => {
                    const shoulderAnkleMidY = (joints.rightShoulder.y + joints.rightAnkle.y) / 2;
                    return joints.rightHip.y < shoulderAnkleMidY - 0.06;
                },
            },
            {
                id: "partial-rep",
                message: "Go chest to floor!",
                severity: "warning",
                check: (_joints, angle, state) => state === "down" && angle < 90 && angle > 65,
            },
        ],
    },

    jumping_jack: {
        id: "jumping_jack",
        name: "Jumping Jack",
        category: "full-body",
        primaryMuscles: ["full-body"],
        secondaryMuscles: ["shoulders", "calves"],
        difficulty: "beginner",
        description: "Jump while spreading arms and legs, then jump back. Great warm-up cardio.",
        tips: [
            "Land softly on the balls of your feet",
            "Full arm extension overhead",
            "Keep a steady rhythm",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightShoulder,
        getAngle: (joints) => {
            const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
            return calculateAngle(hipMid, joints.rightShoulder, joints.rightWrist);
        },
        thresholds: { up: 160, down: 20 },
        requiredJoints: ["rightShoulder", "rightWrist", "leftHip", "rightHip"],
        formRules: [
            {
                id: "arms-not-full",
                message: "Raise arms fully overhead!",
                severity: "warning",
                check: (_joints, angle, state) => state === "down" && angle > 130 && angle < 155,
            },
        ],
    },

    high_knee: {
        id: "high_knee",
        name: "High Knees",
        category: "full-body",
        primaryMuscles: ["abs", "quads"],
        secondaryMuscles: ["calves", "hamstrings"],
        difficulty: "intermediate",
        description: "Run in place, driving knees up to hip height. Great for cardio and core.",
        tips: [
            "Drive knees to hip height",
            "Pump your arms",
            "Land on balls of feet",
        ],
        type: "angle",
        side: "right",
        displayJoint: (joints) => joints.rightKnee,
        getAngle: (joints) => calculateAngle(joints.rightShoulder, joints.rightHip, joints.rightKnee),
        thresholds: { up: 60, down: 160 },
        requiredJoints: ["rightShoulder", "rightHip", "rightKnee"],
        formRules: [
            {
                id: "low-knees",
                message: "Knees higher — hip level!",
                severity: "warning",
                check: (_joints, angle) => angle > 80 && angle < 100,
            },
            {
                id: "leaning-back",
                message: "Stay upright! Don't lean back!",
                severity: "error",
                check: (joints) => getTorsoLean(joints) > 20,
            },
        ],
    },
};

// ─── Derived Data ──────────────────────────────────────────────────────────

/** All exercise IDs in an array */
export const EXERCISE_IDS = Object.keys(EXERCISES);

/** Exercises grouped by category */
export const EXERCISES_BY_CATEGORY: Record<ExerciseCategory, ExerciseConfig[]> = {
    "upper-body": [],
    "lower-body": [],
    "core": [],
    "full-body": [],
};
for (const ex of Object.values(EXERCISES)) {
    EXERCISES_BY_CATEGORY[ex.category].push(ex);
}

/** Exercises grouped by difficulty */
export const EXERCISES_BY_DIFFICULTY: Record<Difficulty, ExerciseConfig[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
};
for (const ex of Object.values(EXERCISES)) {
    EXERCISES_BY_DIFFICULTY[ex.difficulty].push(ex);
}

// ─── Generic Rep Counter Engine ────────────────────────────────────────────

/**
 * Core state machine that works for any angle-based exercise.
 * Checks the current angle against thresholds, transitions states,
 * and evaluates all form rules.
 */
export const updateExercise = (
    joints: KeyJoints,
    angle: number,
    prevState: ExerciseState,
    currentCount: number,
    config: ExerciseConfig
): ExerciseResult => {
    let newState = prevState;
    let newCount = currentCount;
    let feedback: string | undefined;
    let feedbackSeverity: "warning" | "error" | undefined;

    // Calculate progress: mapping current angle between the two thresholds
    const { up, down } = config.thresholds;
    const range = Math.abs(down - up);
    const currentDiff = Math.abs(down - angle);
    const progress = Math.min(Math.max(currentDiff / range, 0), 1);

    // Slightly relax exact threshold transitions to account for pose estimation noise
    const tolerance = 12;
    const upTrigger = down > up ? up + tolerance : up - tolerance;
    const downTrigger = down > up ? down - tolerance : down + tolerance;

    // Evaluate form rules only when the movement is near a rep endpoint.
    const isNearEndpoint = progress <= 0.15 || progress >= 0.85;
    const activeRule = config.formRules.find(rule => {
        if (!rule.check(joints, angle, prevState)) return false;
        if (rule.severity === "warning") {
            return isNearEndpoint;
        }
        return true;
    });
    if (activeRule) {
        feedback = activeRule.message;
        feedbackSeverity = activeRule.severity;
    }

    // State Machine logic
    if (down > up) {
        // Standard (like curl): small angle is "UP", large angle is "DOWN"
        if (prevState === "down" && angle < upTrigger) {
            newState = "up";
        } else if (prevState === "up" && angle > downTrigger) {
            newState = "down";
            newCount = currentCount + 1;
        }
    } else {
        // Reverse (like overhead press): large angle is "UP", small angle is "DOWN"
        if (prevState === "down" && angle > upTrigger) {
            newState = "up";
        } else if (prevState === "up" && angle < downTrigger) {
            newState = "down";
            newCount = currentCount + 1;
        }
    }

    return { newState, newCount, progress, feedback, feedbackSeverity };
};
