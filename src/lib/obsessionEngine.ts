export interface SessionLite {
  id?: string | number;
  exerciseId: string;
  count: number;
  qualityScore: number;
  duration: number;
  timestamp: string;
}

export interface DailyQuest {
  id: string;
  label: string;
  target: number;
  progress: number;
  unit: string;
}

export interface ObsessionMetrics {
  totalReps: number;
  avgQuality: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  xp: number;
  xpForNextLevel: number;
  momentumScore: number;
  mostPlayedExercise: string | null;
  dailyQuests: DailyQuest[];
}

function toDayKey(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function computeStreakDays(dayKeys: string[]): { current: number; longest: number } {
  if (dayKeys.length === 0) return { current: 0, longest: 0 };

  const sorted = [...new Set(dayKeys)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const curr = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const daySet = new Set(sorted);
  const today = toDayKey(new Date().toISOString());
  const yesterday = toDayKey(new Date(Date.now() - 86400000).toISOString());
  let current = 0;
  if (daySet.has(today) || daySet.has(yesterday)) {
    let probe = daySet.has(today) ? today : yesterday;
    while (daySet.has(probe)) {
      current += 1;
      const prev = new Date(`${probe}T00:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() - 1);
      probe = prev.toISOString().slice(0, 10);
    }
  }

  return { current, longest };
}

export function buildObsessionMetrics(sessions: SessionLite[]): ObsessionMetrics {
  const totalReps = sessions.reduce((sum, s) => sum + (s.count || 0), 0);
  const avgQuality = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / sessions.length)
    : 0;
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);

  const streak = computeStreakDays(sessions.map((s) => toDayKey(s.timestamp)));

  const xp = Math.floor(totalReps * 0.8 + avgQuality * 3 + streak.current * 25 + totalMinutes * 2);
  const level = Math.floor(xp / 500) + 1;
  const xpForNextLevel = level * 500;
  const momentumScore = Math.max(0, Math.min(100, Math.round((avgQuality * 0.45) + (streak.current * 4) + Math.min(35, totalMinutes / 5))));

  const exerciseCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    exerciseCounts[s.exerciseId] = (exerciseCounts[s.exerciseId] || 0) + s.count;
  });
  const mostPlayedExercise = Object.keys(exerciseCounts).length
    ? Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const today = toDayKey(new Date().toISOString());
  const todaysSessions = sessions.filter((s) => toDayKey(s.timestamp) === today);
  const repsToday = todaysSessions.reduce((sum, s) => sum + s.count, 0);
  const minutesToday = Math.round(todaysSessions.reduce((sum, s) => sum + s.duration, 0) / 60);
  const qualityToday = todaysSessions.length
    ? Math.round(todaysSessions.reduce((sum, s) => sum + s.qualityScore, 0) / todaysSessions.length)
    : 0;

  const dailyQuests: DailyQuest[] = [
    { id: "reps", label: "Rep Blitz", target: 120, progress: repsToday, unit: "reps" },
    { id: "time", label: "Show Up Time", target: 20, progress: minutesToday, unit: "min" },
    { id: "quality", label: "Elite Form", target: 88, progress: qualityToday, unit: "%" },
  ];

  return {
    totalReps,
    avgQuality,
    totalMinutes,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    level,
    xp,
    xpForNextLevel,
    momentumScore,
    mostPlayedExercise,
    dailyQuests,
  };
}
