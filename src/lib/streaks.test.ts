/**
 * UNIT TESTS — Streaks and achievements
 *
 * Why: streaks are calendar logic (day boundaries, gaps, "today vs yesterday")
 * which is notoriously easy to get wrong. The clock is frozen so the tests are
 * deterministic; the Jest config runs them in UTC.
 */
import { ACHIEVEMENTS, UserStats, computeStreaks, getNextAchievements, getUnlockedAchievements } from "./streaks";

const NOW = new Date("2026-03-18T12:00:00Z"); // a Wednesday
const day = (offset: number, hour = 10) => {
    const d = new Date(NOW);
    d.setUTCDate(d.getUTCDate() - offset);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe("computeStreaks", () => {
    test("empty history", () => {
        expect(computeStreaks([])).toEqual({
            currentStreak: 0, longestStreak: 0, totalWorkoutDays: 0, totalSessions: 0, thisWeekDays: 0, thisMonthDays: 0,
        });
    });

    test("consecutive days ending today form the current streak", () => {
        const r = computeStreaks([0, 1, 2].map((o) => ({ timestamp: day(o) })));
        expect(r.currentStreak).toBe(3);
        expect(r.longestStreak).toBe(3);
    });

    test("multiple sessions on one day count as one workout day", () => {
        const r = computeStreaks([{ timestamp: day(0, 8) }, { timestamp: day(0, 18) }, { timestamp: day(1) }]);
        expect(r.totalSessions).toBe(3);
        expect(r.totalWorkoutDays).toBe(2);
        expect(r.currentStreak).toBe(2);
    });

    test("a gap breaks the current streak but longest is remembered", () => {
        const r = computeStreaks([0, 5, 6, 7, 8].map((o) => ({ timestamp: day(o) })));
        expect(r.currentStreak).toBe(1);
        expect(r.longestStreak).toBe(4);
    });

    test("accepts Date objects as well as strings", () => {
        expect(computeStreaks([{ timestamp: new Date(day(0)) }]).currentStreak).toBe(1);
    });

    test("this week (Mon-Sun) and this month counts", () => {
        // Wed 18th: Mon 16th is in this week, Sun 15th is not; 1st March is this month, 28 Feb is not
        const r = computeStreaks([0, 2, 3, 17, 18].map((o) => ({ timestamp: day(o) })));
        expect(r.thisWeekDays).toBe(2);
        expect(r.thisMonthDays).toBe(4);
    });

    // KNOWN DEFECT (latent — computeStreaks is not used by the UI yet):
    // the code comment says "Allow today or yesterday as start" and both the
    // backend /api/sessions/streaks and obsessionEngine do so, but this
    // implementation returns 0 if the user hasn't trained *today* yet.
    test.failing("streak continuing until yesterday is still current (matches backend)", () => {
        const r = computeStreaks([1, 2, 3].map((o) => ({ timestamp: day(o) })));
        expect(r.currentStreak).toBe(3);
    });
});

describe("achievements", () => {
    const base: UserStats = {
        totalSessions: 0, totalReps: 0, totalMinutes: 0, avgQualityScore: 0, currentStreak: 0,
        longestStreak: 0, exercisesCovered: 0, programsCompleted: 0, perfectSessions: 0,
    };

    test("ids are unique", () => {
        expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    });

    test("a brand-new user has nothing unlocked", () => {
        expect(getUnlockedAchievements(base)).toEqual([]);
    });

    test("thresholds are inclusive", () => {
        const ids = getUnlockedAchievements({ ...base, totalSessions: 10, totalReps: 1000, longestStreak: 7, totalMinutes: 60 })
            .map((a) => a.id);
        expect(ids).toEqual(expect.arrayContaining(["first_workout", "ten_sessions", "thousand_reps", "streak_3", "streak_7", "hour_logged"]));
        expect(ids).not.toContain("fifty_sessions");
        expect(ids).not.toContain("streak_30");
    });

    test("next achievements are the first locked ones, respecting the limit", () => {
        const next = getNextAchievements({ ...base, totalSessions: 1 }, 2);
        expect(next.map((a) => a.id)).toEqual(["ten_sessions", "fifty_sessions"]);
        expect(getNextAchievements(base)).toHaveLength(3);
    });

    test("everything maxed out unlocks all achievements", () => {
        const maxed: UserStats = {
            totalSessions: 1000, totalReps: 100000, totalMinutes: 10000, avgQualityScore: 100, currentStreak: 100,
            longestStreak: 100, exercisesCovered: 12, programsCompleted: 50, perfectSessions: 50,
        };
        expect(getUnlockedAchievements(maxed)).toHaveLength(ACHIEVEMENTS.length);
        expect(getNextAchievements(maxed)).toEqual([]);
    });
});
