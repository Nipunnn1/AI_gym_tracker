/**
 * Biomechanics Engine v2.0
 * 
 * Full-body pose analysis engine built on MediaPipe BlazePose.
 * Provides joint extraction, angle calculation, alignment detection,
 * symmetry analysis, and movement velocity tracking.
 * 
 * MediaPipe Pose Landmark Indices:
 *  0: Nose
 *  1-4: Eyes (inner/outer)
 *  5-6: Ears
 *  7-8: Mouth corners
 *  9-10: Mouth (unused)
 * 11: Left Shoulder  | 12: Right Shoulder
 * 13: Left Elbow     | 14: Right Elbow
 * 15: Left Wrist     | 16: Right Wrist
 * 17: Left Pinky     | 18: Right Pinky
 * 19: Left Index     | 20: Right Index
 * 21: Left Thumb     | 22: Right Thumb
 * 23: Left Hip       | 24: Right Hip
 * 25: Left Knee      | 26: Right Knee
 * 27: Left Ankle     | 28: Right Ankle
 * 29: Left Heel      | 30: Right Heel
 * 31: Left Foot Index| 32: Right Foot Index
 */

export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

export type PoseLandmarks = Landmark[];

export interface KeyJoints {
    nose: Landmark;
    leftEar: Landmark;
    rightEar: Landmark;
    leftShoulder: Landmark;
    rightShoulder: Landmark;
    leftElbow: Landmark;
    rightElbow: Landmark;
    leftWrist: Landmark;
    rightWrist: Landmark;
    leftPinky: Landmark;
    rightPinky: Landmark;
    leftIndex: Landmark;
    rightIndex: Landmark;
    leftThumb: Landmark;
    rightThumb: Landmark;
    leftHip: Landmark;
    rightHip: Landmark;
    leftKnee: Landmark;
    rightKnee: Landmark;
    leftAnkle: Landmark;
    rightAnkle: Landmark;
    leftHeel: Landmark;
    rightHeel: Landmark;
    leftFootIndex: Landmark;
    rightFootIndex: Landmark;
}

/**
 * Extracts all key joints from the landmark array for easier processing.
 */
export const extractKeyJoints = (landmarks: PoseLandmarks): KeyJoints | null => {
    if (!landmarks || landmarks.length < 33) return null;

    return {
        nose: landmarks[0],
        leftEar: landmarks[7],
        rightEar: landmarks[8],
        leftShoulder: landmarks[11],
        rightShoulder: landmarks[12],
        leftElbow: landmarks[13],
        rightElbow: landmarks[14],
        leftWrist: landmarks[15],
        rightWrist: landmarks[16],
        leftPinky: landmarks[17],
        rightPinky: landmarks[18],
        leftIndex: landmarks[19],
        rightIndex: landmarks[20],
        leftThumb: landmarks[21],
        rightThumb: landmarks[22],
        leftHip: landmarks[23],
        rightHip: landmarks[24],
        leftKnee: landmarks[25],
        rightKnee: landmarks[26],
        leftAnkle: landmarks[27],
        rightAnkle: landmarks[28],
        leftHeel: landmarks[29],
        rightHeel: landmarks[30],
        leftFootIndex: landmarks[31],
        rightFootIndex: landmarks[32],
    };
};

/**
 * Normalizes coordinates to pixel values for drawing.
 */
export const toScreenCoords = (landmark: Landmark, width: number, height: number) => {
    return {
        x: landmark.x * width,
        y: landmark.y * height,
    };
};

/**
 * Calculates the angle between three points (A, B, C) where B is the vertex.
 * Uses the atan2 method for robust 4-quadrant calculation.
 */
export const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
    const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);

    let angle = Math.abs((radians * 180.0) / Math.PI);

    if (angle > 180.0) {
        angle = 360 - angle;
    }

    return Math.round(angle);
};

/**
 * Calculates the angle between three points using 3D coordinates (x, y, z).
 * More accurate for depth-aware exercises like push-ups.
 */
export const calculateAngle3D = (a: Landmark, b: Landmark, c: Landmark): number => {
    const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

    const dotProduct = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
    const magnitudeBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
    const magnitudeBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

    if (magnitudeBA === 0 || magnitudeBC === 0) return 0;

    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magnitudeBA * magnitudeBC)));
    return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
};

/**
 * Calculates the midpoint between two landmarks.
 * Useful for finding torso center, hip center, etc.
 */
export const getMidpoint = (a: Landmark, b: Landmark): Landmark => {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
        visibility: Math.min(a.visibility, b.visibility),
    };
};

/**
 * Calculates the Euclidean distance between two landmarks (normalized space).
 */
export const getDistance = (a: Landmark, b: Landmark): number => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
};

/**
 * Calculates the 3D distance between two landmarks.
 */
export const getDistance3D = (a: Landmark, b: Landmark): number => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
};

/**
 * Determines the vertical alignment angle of two landmarks relative to vertical.
 * Returns 0 when perfectly vertical, 90 when horizontal.
 * Useful for checking torso lean, back straightness, etc.
 */
export const getVerticalAlignment = (top: Landmark, bottom: Landmark): number => {
    const dx = top.x - bottom.x;
    const dy = top.y - bottom.y;
    // Angle from vertical (straight up = 0°)
    const angle = Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
    return Math.round(angle);
};

/**
 * Checks if the torso is leaning forward/backward beyond a threshold.
 * Uses shoulder and hip positions.
 */
export const getTorsoLean = (joints: KeyJoints): number => {
    const shoulderMid = getMidpoint(joints.leftShoulder, joints.rightShoulder);
    const hipMid = getMidpoint(joints.leftHip, joints.rightHip);
    return getVerticalAlignment(shoulderMid, hipMid);
};

/**
 * Calculates left/right symmetry ratio for a given exercise.
 * Returns a value from 0 (completely asymmetric) to 1 (perfectly symmetric).
 */
export const getSymmetryRatio = (leftAngle: number, rightAngle: number): number => {
    const max = Math.max(leftAngle, rightAngle);
    if (max === 0) return 1;
    return Math.min(leftAngle, rightAngle) / max;
};

/**
 * Simple velocity tracker: call with the angle at each frame to get angular velocity.
 * Useful for detecting ballistic/jerky movements vs. controlled form.
 */
export class VelocityTracker {
    private prevAngle: number | null = null;
    private prevTimestamp: number | null = null;

    /** Returns angular velocity in degrees per second. Null on first call. */
    update(angle: number, timestampMs: number = Date.now()): number | null {
        if (this.prevAngle === null || this.prevTimestamp === null) {
            this.prevAngle = angle;
            this.prevTimestamp = timestampMs;
            return null;
        }

        const dt = (timestampMs - this.prevTimestamp) / 1000; // seconds
        if (dt <= 0) return null;

        const velocity = Math.abs(angle - this.prevAngle) / dt;
        this.prevAngle = angle;
        this.prevTimestamp = timestampMs;

        return Math.round(velocity);
    }

    reset() {
        this.prevAngle = null;
        this.prevTimestamp = null;
    }
}

/**
 * Checks if a specific set of joints has sufficient visibility.
 * Returns true if ALL specified joints are above the threshold.
 */
export const areJointsVisible = (
    joints: KeyJoints,
    jointNames: (keyof KeyJoints)[],
    minVisibility: number = 0.5
): boolean => {
    return jointNames.every(name => joints[name].visibility > minVisibility);
};

/**
 * Gets the body orientation (front-facing, side-facing, or back-facing)
 * based on shoulder and hip z-depth differences.
 */
export type BodyOrientation = "front" | "left-side" | "right-side" | "back";
export const getBodyOrientation = (joints: KeyJoints): BodyOrientation => {
    const shoulderDiffZ = joints.leftShoulder.z - joints.rightShoulder.z;
    const shoulderDiffX = joints.leftShoulder.x - joints.rightShoulder.x;

    // If shoulders are close in x but differ in z → side view
    if (Math.abs(shoulderDiffX) < 0.05) {
        return shoulderDiffZ > 0 ? "left-side" : "right-side";
    }

    // Small z difference → front or back
    if (Math.abs(shoulderDiffZ) < 0.1) {
        // If left shoulder is to the right of right shoulder in image space → back facing
        return shoulderDiffX < 0 ? "back" : "front";
    }

    return shoulderDiffZ > 0 ? "left-side" : "right-side";
};
