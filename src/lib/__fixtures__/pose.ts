import type { KeyJoints, Landmark, PoseLandmarks } from "../biomechanics";
import { extractKeyJoints } from "../biomechanics";

/** Builds a landmark with sensible defaults (fully visible). */
export const lm = (x: number, y: number, z = 0, visibility = 0.99): Landmark => ({ x, y, z, visibility });

/**
 * A neutral, upright, front-facing standing skeleton in MediaPipe's normalised
 * image space (x to the right, y downwards). Torso lean is 0, legs are straight.
 */
export function standingLandmarks(): PoseLandmarks {
    const points: PoseLandmarks = Array.from({ length: 33 }, () => lm(0.5, 0.5));
    points[0] = lm(0.5, 0.1); // nose
    points[7] = lm(0.55, 0.1); // left ear
    points[8] = lm(0.45, 0.1); // right ear
    points[11] = lm(0.6, 0.3); // left shoulder (appears on image right for a front-facing person)
    points[12] = lm(0.4, 0.3); // right shoulder
    points[13] = lm(0.6, 0.45); // left elbow
    points[14] = lm(0.4, 0.45); // right elbow
    points[15] = lm(0.6, 0.6); // left wrist
    points[16] = lm(0.4, 0.6); // right wrist
    points[23] = lm(0.58, 0.6); // left hip
    points[24] = lm(0.42, 0.6); // right hip
    points[25] = lm(0.58, 0.75); // left knee
    points[26] = lm(0.42, 0.75); // right knee
    points[27] = lm(0.58, 0.9); // left ankle
    points[28] = lm(0.42, 0.9); // right ankle
    points[29] = lm(0.58, 0.92); // left heel
    points[30] = lm(0.42, 0.92); // right heel
    points[31] = lm(0.62, 0.93); // left foot index
    points[32] = lm(0.46, 0.93); // right foot index
    return points;
}

export function standingJoints(overrides: Partial<KeyJoints> = {}): KeyJoints {
    const joints = extractKeyJoints(standingLandmarks());
    if (!joints) throw new Error("fixture skeleton is invalid");
    return { ...joints, ...overrides };
}
