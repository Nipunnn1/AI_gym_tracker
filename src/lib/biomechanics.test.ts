import { calculateAngle } from './biomechanics';

describe('Biomechanics Engine: calculateAngle', () => {
    test('returns 90 degrees for a right-angled triangle', () => {
        const shoulder = { x: 0, y: 0, z: 0, visibility: 0.9 };
        const elbow = { x: 1, y: 0, z: 0, visibility: 0.9 };
        const wrist = { x: 1, y: 1, z: 0, visibility: 0.9 };

        // We expect the angle between (0,0)-(1,0) and (1,0)-(1,1) to be 90
        expect(calculateAngle(shoulder, elbow, wrist)).toBeCloseTo(90);
    });

    test('returns 180 degrees for a straight line', () => {
        const shoulder = { x: 0, y: 0, z: 0, visibility: 0.9 };
        const elbow = { x: 1, y: 0, z: 0, visibility: 0.9 };
        const wrist = { x: 2, y: 0, z: 0, visibility: 0.9 };

        expect(calculateAngle(shoulder, elbow, wrist)).toBeCloseTo(180);
    });

    test('returns 0 degrees for a fully closed joint', () => {
        const shoulder = { x: 0, y: 0, z: 0, visibility: 0.9 };
        const elbow = { x: 1, y: 1, z: 0, visibility: 0.9 };
        const wrist = { x: 0, y: 0, z: 0, visibility: 0.9 };

        expect(calculateAngle(shoulder, elbow, wrist)).toBeCloseTo(0);
    });
});
