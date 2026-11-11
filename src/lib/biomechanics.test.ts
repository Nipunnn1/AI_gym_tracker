/**
 * UNIT TESTS — Biomechanics engine
 *
 * Why: every rep count and form warning in the app is derived from these
 * geometry helpers. A wrong angle here silently corrupts rep counts, quality
 * scores and personal records downstream, so the maths is pinned down in
 * isolation with hand-computable inputs.
 */
import {
    VelocityTracker,
    areJointsVisible,
    calculateAngle,
    calculateAngle3D,
    extractKeyJoints,
    getBodyOrientation,
    getDistance,
    getDistance3D,
    getMidpoint,
    getSymmetryRatio,
    getTorsoLean,
    getVerticalAlignment,
    toScreenCoords,
} from "./biomechanics";
import { lm, standingJoints, standingLandmarks } from "./__fixtures__/pose";

describe("calculateAngle (2D)", () => {
    test("returns 90 degrees for a right angle", () => {
        expect(calculateAngle(lm(0, 0), lm(1, 0), lm(1, 1))).toBe(90);
    });

    test("returns 180 degrees for a straight line", () => {
        expect(calculateAngle(lm(0, 0), lm(1, 0), lm(2, 0))).toBe(180);
    });

    test("returns 0 degrees for a fully closed joint", () => {
        expect(calculateAngle(lm(0, 0), lm(1, 1), lm(0, 0))).toBe(0);
    });

    test("returns 45 degrees and rounds to an integer", () => {
        expect(calculateAngle(lm(1, 0), lm(0, 0), lm(1, 1))).toBe(45);
        expect(Number.isInteger(calculateAngle(lm(0.1, 0.37), lm(0.42, 0.5), lm(0.9, 0.11)))).toBe(true);
    });

    test("never exceeds 180 (reflex angles are folded back)", () => {
        // 270 degree sweep should be reported as 90
        expect(calculateAngle(lm(0, -1), lm(0, 0), lm(-1, 0))).toBe(90);
        for (let i = 0; i < 50; i++) {
            const a = calculateAngle(lm(Math.cos(i), Math.sin(i)), lm(0, 0), lm(Math.cos(i * 3), Math.sin(i * 7)));
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(180);
        }
    });

    test("is symmetric in its outer points", () => {
        const a = lm(0.2, 0.3), b = lm(0.5, 0.5), c = lm(0.9, 0.1);
        expect(calculateAngle(a, b, c)).toBe(calculateAngle(c, b, a));
    });
});

describe("calculateAngle3D", () => {
    test("uses depth: a joint bent only in z is detected", () => {
        // In 2D these points are collinear (180) but in 3D they form 90 degrees.
        const a = lm(0, 0, 0), b = lm(1, 0, 0), c = lm(1, 0, 1);
        expect(calculateAngle3D(a, b, c)).toBe(90);
    });

    test("returns 180 for a straight 3D line", () => {
        expect(calculateAngle3D(lm(0, 0, 0), lm(1, 1, 1), lm(2, 2, 2))).toBe(180);
    });

    test("returns 0 instead of NaN when two points coincide", () => {
        expect(calculateAngle3D(lm(1, 1, 1), lm(1, 1, 1), lm(2, 2, 2))).toBe(0);
    });
});

describe("distance / midpoint helpers", () => {
    test("getMidpoint averages coordinates and takes the lower visibility", () => {
        expect(getMidpoint(lm(0, 0, 0, 0.9), lm(2, 4, 6, 0.3))).toEqual({ x: 1, y: 2, z: 3, visibility: 0.3 });
    });

    test("getDistance ignores z, getDistance3D includes it", () => {
        expect(getDistance(lm(0, 0, 0), lm(3, 4, 12))).toBe(5);
        expect(getDistance3D(lm(0, 0, 0), lm(3, 4, 12))).toBe(13);
    });

    test("toScreenCoords scales normalised coords to pixels", () => {
        expect(toScreenCoords(lm(0.25, 0.5), 640, 480)).toEqual({ x: 160, y: 240 });
    });
});

describe("posture helpers", () => {
    test("getVerticalAlignment is 0 for vertical and 90 for horizontal", () => {
        expect(getVerticalAlignment(lm(0.5, 0.2), lm(0.5, 0.8))).toBe(0);
        expect(getVerticalAlignment(lm(0.8, 0.5), lm(0.2, 0.5))).toBe(90);
        expect(getVerticalAlignment(lm(0.6, 0.4), lm(0.5, 0.5))).toBe(45);
    });

    test("getTorsoLean is 0 when upright and grows when leaning", () => {
        expect(getTorsoLean(standingJoints())).toBe(0);
        const leaning = standingJoints({ leftShoulder: lm(0.75, 0.35), rightShoulder: lm(0.55, 0.35) });
        expect(getTorsoLean(leaning)).toBeGreaterThan(30);
    });

    test("getSymmetryRatio", () => {
        expect(getSymmetryRatio(90, 90)).toBe(1);
        expect(getSymmetryRatio(45, 90)).toBe(0.5);
        expect(getSymmetryRatio(90, 45)).toBe(0.5);
        expect(getSymmetryRatio(0, 0)).toBe(1);
    });
});

describe("extractKeyJoints", () => {
    test("returns null when MediaPipe gives fewer than 33 landmarks", () => {
        expect(extractKeyJoints([])).toBeNull();
        expect(extractKeyJoints(standingLandmarks().slice(0, 32))).toBeNull();
        expect(extractKeyJoints(null as unknown as [])).toBeNull();
    });

    test("maps the documented MediaPipe indices", () => {
        const points = standingLandmarks();
        const joints = extractKeyJoints(points)!;
        expect(joints.nose).toBe(points[0]);
        expect(joints.leftShoulder).toBe(points[11]);
        expect(joints.rightShoulder).toBe(points[12]);
        expect(joints.leftHip).toBe(points[23]);
        expect(joints.rightKnee).toBe(points[26]);
        expect(joints.rightFootIndex).toBe(points[32]);
    });
});

describe("areJointsVisible", () => {
    test("requires every listed joint to exceed the threshold", () => {
        const joints = standingJoints({ rightWrist: lm(0.4, 0.6, 0, 0.3) });
        expect(areJointsVisible(joints, ["rightShoulder", "rightElbow"])).toBe(true);
        expect(areJointsVisible(joints, ["rightShoulder", "rightWrist"])).toBe(false);
        expect(areJointsVisible(joints, ["rightShoulder", "rightWrist"], 0.2)).toBe(true);
    });
});

describe("getBodyOrientation", () => {
    test("front-facing when left shoulder is on image right", () => {
        expect(getBodyOrientation(standingJoints())).toBe("front");
    });

    test("back-facing when left shoulder is on image left", () => {
        expect(getBodyOrientation(standingJoints({ leftShoulder: lm(0.4, 0.3), rightShoulder: lm(0.6, 0.3) }))).toBe("back");
    });

    test("side-facing when shoulders overlap in x", () => {
        expect(getBodyOrientation(standingJoints({ leftShoulder: lm(0.5, 0.3, 0.2), rightShoulder: lm(0.51, 0.3, -0.2) }))).toBe("left-side");
        expect(getBodyOrientation(standingJoints({ leftShoulder: lm(0.5, 0.3, -0.2), rightShoulder: lm(0.51, 0.3, 0.2) }))).toBe("right-side");
    });
});

describe("VelocityTracker", () => {
    test("returns null on the first sample, then degrees per second", () => {
        const t = new VelocityTracker();
        expect(t.update(90, 1000)).toBeNull();
        expect(t.update(120, 1500)).toBe(60); // 30 deg in 0.5 s
        expect(t.update(60, 2500)).toBe(60); // magnitude only
    });

    test("ignores non-increasing timestamps", () => {
        const t = new VelocityTracker();
        t.update(10, 1000);
        expect(t.update(50, 1000)).toBeNull();
    });

    test("reset() starts over", () => {
        const t = new VelocityTracker();
        t.update(10, 1000);
        t.reset();
        expect(t.update(100, 2000)).toBeNull();
    });
});
