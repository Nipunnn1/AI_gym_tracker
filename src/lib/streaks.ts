/**
 * Streaks & Achievements Engine
 *
 * Tracks workout consistency and unlocks achievements
 * based on user behavior. Designed to be computed from
 * session history fetched from the backend.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WorkoutDay {
    date: string; // ISO date string (YYYY-MM-DD)
    sessionCount: number;
    totalReps: number;
    avgQuality: number;
}

export interface StreakInfo {
    currentStreak: number; // consecutive days
    longestStreak: number;
    totalWorkoutDays: number;
    totalSessions: number;
    thisWeekDays: number; // days worked out this week (Mon-Sun)
    thisMonthDays: number;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji
    condition: (stats: UserStats) => boolean;
}

export interface UserStats {
    totalSessions: number;
    totalReps: number;
    totalMinutes: number;
    avgQualityScore: number;
    currentStreak: number;
    longestStreak: number;
    exercisesCovered: number; // unique exercises done
    programsCompleted: number;
    perfectSessions: number; // quality >= 90
}

// ─── Streak Calculation ────────────────────────────────────────────────────

/**
 * Computes streak info from a list of sessions.
 * Sessions should have a `timestamp` field (ISO string or Date).
 */
export function computeStreaks(sessions: { timestamp: string | Date }[]): StreakInfo {
    if (sessions.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            totalWorkoutDays: 0,
            totalSessions: sessions.length,
            thisWeekDays: 0,
            thisMonthDays: 0,
        };
    }

    // Get unique workout dates
    const dateSet = new Set<string>();
    for (const s of sessions) {
        const d = new Date(s.timestamp);
        dateSet.add(d.toISOString().split("T")[0]);
    }

    const sortedDates = Array.from(dateSet).sort().reverse(); // most recent first
    const today = new Date().toISOString().split("T")[0];

    // Current streak: consecutive days from today backwards
    let currentStreak = 0;
    const checkDate = new Date();
    // Allow today or yesterday as start
    if (sortedDates[0] === today) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
        for (let i = 1; i < sortedDates.length; i++) {
            const expected = checkDate.toISOString().split("T")[0];
            if (sortedDates[i] === expected) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    }

    // Longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    const allDates = Array.from(dateSet).sort(); // oldest first
    for (let i = 1; i < allDates.length; i++) {
        const prev = new Date(allDates[i - 1]);
        const curr = new Date(allDates[i]);
        const diffMs = curr.getTime() - prev.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

    // This week
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Monday = 1
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekDays = allDates.filter(d => new Date(d) >= weekStart).length;

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthDays = allDates.filter(d => new Date(d) >= monthStart).length;

    return {
        currentStreak,
        longestStreak,
        totalWorkoutDays: dateSet.size,
        totalSessions: sessions.length,
        thisWeekDays,
        thisMonthDays,
    };
}

// ─── Achievements ──────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: "first_workout",
        name: "First Rep",
        description: "Complete your first workout session",
        icon: "🎯",
        condition: (stats) => stats.totalSessions >= 1,
    },
    {
        id: "ten_sessions",
        name: "Dedicated",
        description: "Complete 10 workout sessions",
        icon: "💪",
        condition: (stats) => stats.totalSessions >= 10,
    },
    {
        id: "fifty_sessions",
        name: "Iron Will",
        description: "Complete 50 workout sessions",
        icon: "🏋️",
        condition: (stats) => stats.totalSessions >= 50,
    },
    {
        id: "hundred_sessions",
        name: "Century Club",
        description: "Complete 100 workout sessions",
        icon: "🏆",
        condition: (stats) => stats.totalSessions >= 100,
    },
    {
        id: "thousand_reps",
        name: "Rep Machine",
        description: "Complete 1,000 total reps",
        icon: "⚡",
        condition: (stats) => stats.totalReps >= 1000,
    },
    {
        id: "ten_thousand_reps",
        name: "10K Club",
        description: "Complete 10,000 total reps",
        icon: "🔥",
        condition: (stats) => stats.totalReps >= 10000,
    },
    {
        id: "streak_3",
        name: "Hat Trick",
        description: "Maintain a 3-day workout streak",
        icon: "🎩",
        condition: (stats) => stats.longestStreak >= 3,
    },
    {
        id: "streak_7",
        name: "Unstoppable",
        description: "Maintain a 7-day workout streak",
        icon: "🔥",
        condition: (stats) => stats.longestStreak >= 7,
    },
    {
        id: "streak_30",
        name: "Monthly Warrior",
        description: "Maintain a 30-day workout streak",
        icon: "👑",
        condition: (stats) => stats.longestStreak >= 30,
    },
    {
        id: "perfect_form",
        name: "Perfect Form",
        description: "Complete 5 sessions with 90%+ quality score",
        icon: "✨",
        condition: (stats) => stats.perfectSessions >= 5,
    },
    {
        id: "all_exercises",
        name: "Jack of All Trades",
        description: "Try all 12 exercises",
        icon: "🌟",
        condition: (stats) => stats.exercisesCovered >= 12,
    },
    {
        id: "hour_logged",
        name: "Hour Power",
        description: "Log 60 minutes of total workout time",
        icon: "⏱️",
        condition: (stats) => stats.totalMinutes >= 60,
    },
    {
        id: "five_hours",
        name: "Time Invested",
        description: "Log 5 hours of total workout time",
        icon: "🕐",
        condition: (stats) => stats.totalMinutes >= 300,
    },
];

/**
 * Given user stats, returns the list of unlocked achievements.
 */
export function getUnlockedAchievements(stats: UserStats): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.condition(stats));
}

/**
 * Given user stats, returns the next locked achievements (up to `limit`).
 */
export function getNextAchievements(stats: UserStats, limit: number = 3): Achievement[] {
    return ACHIEVEMENTS.filter(a => !a.condition(stats)).slice(0, limit);
}
