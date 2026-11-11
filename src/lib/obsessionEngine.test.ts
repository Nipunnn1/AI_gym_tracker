/**
 * UNIT TESTS — Dashboard gamification metrics (obsessionEngine)
 *
 * Why: buildObsessionMetrics() turns raw sessions from the API into the XP,
 * level, streak and daily-quest numbers on the dashboard. It's the only lib
 * module the Dashboard imports directly, so its formulas are pinned down here.
 */
import { SessionLite, buildObsessionMetrics } from "./obsessionEngine";

const NOW = new Date("2026-03-18T12:00:00Z");
const at = (daysAgo: number, extra: Partial<SessionLite> = {}): SessionLite => ({
    exerciseId: "squat",
    count: 10,
    qualityScore: 90,
    duration: 120,
    timestamp: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
    ...extra,
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

test("no sessions → level 1 with zeroed metrics", () => {
    const m = buildObsessionMetrics([]);
    expect(m).toMatchObject({
        totalReps: 0, avgQuality: 0, totalMinutes: 0, currentStreak: 0, longestStreak: 0,
        xp: 0, level: 1, xpForNextLevel: 500, momentumScore: 0, mostPlayedExercise: null,
    });
    expect(m.dailyQuests.map((q) => q.progress)).toEqual([0, 0, 0]);
});

test("aggregates reps, quality and minutes", () => {
    const m = buildObsessionMetrics([at(0, { count: 20, qualityScore: 80, duration: 600 }), at(0, { count: 10, qualityScore: 100, duration: 600 })]);
    expect(m.totalReps).toBe(30);
    expect(m.avgQuality).toBe(90);
    expect(m.totalMinutes).toBe(20);
});

test("XP and level formula", () => {
    // xp = floor(reps*0.8 + quality*3 + streak*25 + minutes*2) = 8 + 270 + 25 + 4 = 307
    const m = buildObsessionMetrics([at(0)]);
    expect(m.xp).toBe(307);
    expect(m.level).toBe(1);

    const big = buildObsessionMetrics([at(0, { count: 1000 })]); // 800 + 270 + 25 + 4 = 1099
    expect(big.xp).toBe(1099);
    expect(big.level).toBe(3);
    expect(big.xpForNextLevel).toBe(1500);
});

test("current streak counts back from yesterday if today is empty", () => {
    const m = buildObsessionMetrics([at(1), at(2), at(3), at(6)]);
    expect(m.currentStreak).toBe(3);
    expect(m.longestStreak).toBe(3);
});

test("streak is broken after two idle days", () => {
    expect(buildObsessionMetrics([at(2), at(3)]).currentStreak).toBe(0);
});

test("momentum score is clamped to 0..100", () => {
    const sessions = Array.from({ length: 40 }, (_, i) => at(i, { qualityScore: 100, duration: 3600 }));
    expect(buildObsessionMetrics(sessions).momentumScore).toBe(100);
});

test("most played exercise is by total reps, not session count", () => {
    const m = buildObsessionMetrics([at(0, { exerciseId: "curl", count: 5 }), at(0, { exerciseId: "curl", count: 5 }), at(0, { exerciseId: "pushup", count: 50 })]);
    expect(m.mostPlayedExercise).toBe("pushup");
});

test("daily quests only count today's sessions", () => {
    const m = buildObsessionMetrics([at(0, { count: 30, duration: 300, qualityScore: 80 }), at(1, { count: 500 })]);
    const byId = Object.fromEntries(m.dailyQuests.map((q) => [q.id, q]));
    expect(byId.reps).toMatchObject({ progress: 30, target: 120 });
    expect(byId.time).toMatchObject({ progress: 5, target: 20 });
    expect(byId.quality).toMatchObject({ progress: 80, target: 88 });
});
