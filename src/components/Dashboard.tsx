"use client";

import { useCallback, useEffect, useState } from "react";
import { buildObsessionMetrics, SessionLite } from "@/lib/obsessionEngine";

interface Achievement {
    key: string;
    unlocked: boolean;
    threshold: number;
    progress: number;
}

interface SessionsResponse {
    sessions?: Array<{
        id?: string | number;
        _id?: string | number;
        exerciseId: string;
        count: number;
        qualityScore: number;
        duration: number;
        timestamp: string;
    }>;
}

interface AchievementsResponse {
    achievements?: Achievement[];
}

interface TrendsResponse {
    points?: { week: string; reps: number }[];
}

interface DailyMissionResponse {
    missionTitle: string;
    repsGoal: number;
    minutesGoal: number;
    qualityGoal: number;
    rewardXp: number;
}

interface GhostTargetResponse {
    exerciseId: string;
    targetReps: number;
    targetQuality: number;
    challengeText: string;
}

interface ComebackResponse {
    status: "new" | "active" | "comeback_needed";
    daysInactive: number;
    headline: string;
    actions: string[];
}

interface LeaderboardEntry {
    rank: number;
    userId: string;
    totalReps: number;
    avgQuality: number;
}

interface LeaderboardResponse {
    leaderboard: LeaderboardEntry[];
}

interface ReadinessResponse {
    readinessScore: number;
    status: "fresh" | "ready" | "peak" | "recover";
    explanation: string;
    recentSessionCount: number;
}

interface SmartPlanResponse {
    goal: string;
    headline: string;
    estimatedMinutes: number;
    exercises: Array<{
        exerciseId: string;
        sets: number;
        targetReps: number;
        restSeconds: number;
    }>;
    premiumNudge: {
        title: string;
        value: string;
    };
}

interface MonetizationSignalsResponse {
    conversionLikelihood: "high" | "medium";
    triggers: string[];
    recommendedOffer: string;
}

export default function Dashboard() {
    const [sessions, setSessions] = useState<SessionLite[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [trendPoints, setTrendPoints] = useState<{ week: string; reps: number }[]>([]);
    const [dailyMission, setDailyMission] = useState<DailyMissionResponse | null>(null);
    const [ghostTarget, setGhostTarget] = useState<GhostTargetResponse | null>(null);
    const [comebackPlan, setComebackPlan] = useState<ComebackResponse | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
    const [smartPlan, setSmartPlan] = useState<SmartPlanResponse | null>(null);
    const [signals, setSignals] = useState<MonetizationSignalsResponse | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const fetchSessions = useCallback(async () => {
        try {
            setApiError(null);
            const [
                sessionsResp,
                achievementsResp,
                trendsResp,
                missionResp,
                comebackResp,
                leaderboardResp,
                readinessResp,
                smartPlanResp,
                signalResp,
            ] = await Promise.all([
                fetch(`${API_BASE_URL}/api/sessions`),
                fetch(`${API_BASE_URL}/api/sessions/achievements`),
                fetch(`${API_BASE_URL}/api/sessions/trends`),
                fetch(`${API_BASE_URL}/api/growth/daily-mission`),
                fetch(`${API_BASE_URL}/api/growth/comeback-plan`),
                fetch(`${API_BASE_URL}/api/growth/leaderboard`),
                fetch(`${API_BASE_URL}/api/growth/readiness`),
                fetch(`${API_BASE_URL}/api/growth/smart-plan?goal=balanced`),
                fetch(`${API_BASE_URL}/api/growth/monetization-signals`),
            ]);
            const sessionsData: SessionsResponse = await sessionsResp.json();
            const achievementsData: AchievementsResponse = await achievementsResp.json();
            const trendsData: TrendsResponse = await trendsResp.json();
            const missionData: DailyMissionResponse = await missionResp.json();
            const comebackData: ComebackResponse = await comebackResp.json();
            const leaderboardData: LeaderboardResponse = await leaderboardResp.json();
            const readinessData: ReadinessResponse = await readinessResp.json();
            const smartPlanData: SmartPlanResponse = await smartPlanResp.json();
            const signalData: MonetizationSignalsResponse = await signalResp.json();

            const normalized: SessionLite[] = (sessionsData.sessions || []).map((s) => ({
                id: s.id ?? s._id,
                exerciseId: s.exerciseId,
                count: s.count,
                qualityScore: s.qualityScore,
                duration: s.duration,
                timestamp: s.timestamp,
            }));

            setSessions(normalized);
            setAchievements(achievementsData.achievements || []);
            setTrendPoints(trendsData.points || []);
            setDailyMission(missionData);
            setComebackPlan(comebackData);
            setLeaderboard(leaderboardData.leaderboard || []);
            setReadiness(readinessData);
            setSmartPlan(smartPlanData);
            setSignals(signalData);

            const favoriteExercise = normalized[0]?.exerciseId || "curl";
            const ghostResp = await fetch(`${API_BASE_URL}/api/growth/ghost-target?exerciseId=${favoriteExercise}`);
            const ghostData: GhostTargetResponse = await ghostResp.json();
            setGhostTarget(ghostData);
        } catch (err) {
            console.warn("Dashboard API unavailable:", err);
            setApiError("Backend API is offline. Start server on port 5000 to load analytics.");
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const metrics = buildObsessionMetrics(sessions);
    const xpProgress = Math.min(100, Math.round((metrics.xp / metrics.xpForNextLevel) * 100));
    const unlockedAchievements = achievements.filter((a) => a.unlocked).length;
    const nextAchievements = achievements.filter((a) => !a.unlocked).slice(0, 3);

    if (loading) return <div className="text-zinc-500 text-sm animate-pulse">Loading Analytics...</div>;

    if (apiError) {
        return (
            <div className="w-full bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
                <p className="text-amber-300 text-sm font-semibold">{apiError}</p>
                <p className="text-zinc-400 text-xs mt-2">Run: <span className="font-mono">cd server && npm run dev</span></p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Identity + Level */}
            <div className="bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/30 p-5 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">Athlete Level</p>
                        <p className="text-3xl font-black">LVL {metrics.level}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-zinc-400 text-xs uppercase tracking-widest">Momentum</p>
                        <p className="text-2xl font-black text-emerald-400">{metrics.momentumScore}</p>
                    </div>
                </div>
                <div className="mt-4 w-full h-2 bg-zinc-900/70 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${xpProgress}%` }} />
                </div>
                <p className="text-xs text-zinc-400 mt-2">{metrics.xp} XP / {metrics.xpForNextLevel} XP</p>
            </div>

            {/* Core Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl backdrop-blur-sm">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Total volume</p>
                    <p className="text-4xl font-black text-white">{metrics.totalReps} <span className="text-lg text-zinc-600 font-medium">REPS</span></p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl backdrop-blur-sm">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Avg Form Quality</p>
                    <p className={`text-4xl font-black ${metrics.avgQuality > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{metrics.avgQuality}%</p>
                </div>
            </div>

            {/* Backend-powered growth cards */}
            <div className="grid grid-cols-1 gap-4">
                {readiness && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">AI Readiness Score</h3>
                            <p className={`text-xs font-bold uppercase ${readiness.status === "peak" ? "text-emerald-400" : readiness.status === "recover" ? "text-amber-400" : "text-cyan-400"}`}>
                                {readiness.status}
                            </p>
                        </div>
                        <p className="text-3xl font-black text-white mt-2">{readiness.readinessScore}</p>
                        <p className="text-sm text-zinc-300 mt-2">{readiness.explanation}</p>
                    </div>
                )}
                {dailyMission && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">{dailyMission.missionTitle}</h3>
                            <p className="text-xs font-bold text-emerald-400">+{dailyMission.rewardXp} XP</p>
                        </div>
                        <p className="text-sm text-zinc-300 mt-2">
                            Hit {dailyMission.repsGoal} reps, {dailyMission.minutesGoal} min, {dailyMission.qualityGoal}% quality.
                        </p>
                    </div>
                )}
                {ghostTarget && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                        <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Ghost Challenge</h3>
                        <p className="text-sm text-zinc-300 mt-2">{ghostTarget.challengeText}</p>
                        <p className="text-xs text-zinc-500 mt-2">
                            Target: {ghostTarget.targetReps} reps at {ghostTarget.targetQuality}% quality
                        </p>
                    </div>
                )}
                {comebackPlan && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                        <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">AI Comeback Plan</h3>
                        <p className="text-sm text-zinc-300 mt-2">{comebackPlan.headline}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {comebackPlan.actions.map((item) => (
                                <span key={item} className="text-[11px] px-2 py-1 rounded-md bg-zinc-800 text-zinc-300">
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {smartPlan && (
                    <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                        <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Smart Workout Plan</h3>
                        <p className="text-sm text-zinc-300 mt-2">{smartPlan.headline} • ~{smartPlan.estimatedMinutes} min</p>
                        <div className="mt-3 space-y-1">
                            {smartPlan.exercises.slice(0, 3).map((ex) => (
                                <p key={ex.exerciseId} className="text-xs text-zinc-400 capitalize">
                                    {ex.exerciseId.replaceAll("_", " ")}: {ex.sets}x{ex.targetReps} (rest {ex.restSeconds}s)
                                </p>
                            ))}
                        </div>
                    </div>
                )}
                {signals && (
                    <div className="bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 border border-fuchsia-500/20 p-5 rounded-2xl backdrop-blur-sm">
                        <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Pro Offer Intelligence</h3>
                        <p className="text-sm text-zinc-300 mt-2">{signals.recommendedOffer}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {signals.triggers.map((trigger) => (
                                <span key={trigger} className="text-[11px] px-2 py-1 rounded-md bg-black/30 text-zinc-300">
                                    {trigger.replaceAll("_", " ")}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Habit Loop */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Daily Quest Stack</h3>
                    <p className="text-xs text-emerald-400 font-bold">Streak {metrics.currentStreak}d</p>
                </div>
                <div className="space-y-3">
                    {metrics.dailyQuests.map((quest) => {
                        const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
                        return (
                            <div key={quest.id}>
                                <div className="flex items-center justify-between text-xs">
                                    <p className="text-zinc-300 font-semibold">{quest.label}</p>
                                    <p className="text-zinc-400">{quest.progress}/{quest.target} {quest.unit}</p>
                                </div>
                                <div className="mt-1 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[11px] text-zinc-500">
                    Longest streak: {metrics.longestStreak} days. Favorite move: {metrics.mostPlayedExercise || "N/A"}.
                </p>
            </div>

            {/* Social proof style progression */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Achievement Track</h3>
                    <p className="text-xs text-zinc-400">{unlockedAchievements}/{achievements.length} unlocked</p>
                </div>
                <div className="space-y-2">
                    {nextAchievements.length === 0 ? (
                        <p className="text-emerald-400 text-sm font-semibold">All current milestones unlocked. Beast mode.</p>
                    ) : (
                        nextAchievements.map((item) => (
                            <div key={item.key} className="text-xs text-zinc-300 border border-zinc-800 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold">{item.key.replaceAll("_", " ")}</p>
                                    <p className="text-zinc-500">{item.progress}/{item.threshold}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Weekly trend bars */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs mb-4">Weekly Momentum</h3>
                <div className="flex items-end gap-2 h-28">
                    {trendPoints.slice(-8).map((point) => {
                        const maxReps = Math.max(...trendPoints.map((p) => p.reps), 1);
                        const height = Math.max(10, Math.round((point.reps / maxReps) * 100));
                        return (
                            <div key={point.week} className="flex-1">
                                <div className="bg-emerald-500/80 rounded-t-md w-full" style={{ height: `${height}%` }} />
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-zinc-100 uppercase tracking-wider text-xs">Leaderboard</h3>
                    <p className="text-xs text-zinc-500">Top reps</p>
                </div>
                <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry) => (
                        <div key={`${entry.rank}-${entry.userId}`} className="flex items-center justify-between text-xs border border-zinc-800 rounded-lg px-3 py-2">
                            <p className="text-zinc-300 font-semibold">#{entry.rank} {entry.userId}</p>
                            <p className="text-zinc-500">{entry.totalReps} reps • {entry.avgQuality}%</p>
                        </div>
                    ))}
                    {leaderboard.length === 0 && (
                        <p className="text-zinc-600 text-sm italic">No leaderboard data yet.</p>
                    )}
                </div>
            </div>

            {/* History Table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-zinc-200 uppercase tracking-wider text-xs">Recent Activity</h3>
                    <button onClick={fetchSessions} className="text-zinc-500 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {sessions.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-sm italic">No data yet. Complete a workout to see history.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="text-[10px] text-zinc-500 uppercase font-black tracking-widest bg-black/20">
                                <tr>
                                    <th className="px-6 py-3">Exercise</th>
                                    <th className="px-6 py-3">Reps</th>
                                    <th className="px-6 py-3 text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs text-zinc-300 divide-y divide-zinc-800/50">
                                {sessions.map((s) => (
                                    <tr key={s.id || `${s.exerciseId}-${s.timestamp}`} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 capitalize font-medium text-zinc-200">{s.exerciseId}</td>
                                        <td className="px-6 py-4">{s.count}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${s.qualityScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{s.qualityScore}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
