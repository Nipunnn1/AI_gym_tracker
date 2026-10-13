const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Session = require('../models/Session');
const PersonalRecord = require('../models/PersonalRecord');

/**
 * GET /api/sessions
 * Fetch session history with optional filters.
 * 
 * Query params:
 *  - exerciseId: filter by exercise
 *  - programId: filter by program
 *  - limit: max results (default 50)
 *  - offset: pagination offset (default 0)
 *  - from: start date (ISO string)
 *  - to: end date (ISO string)
 */
router.get('/', async (req, res) => {
    try {
        const { userId, exerciseId, programId, limit = 50, offset = 0, from, to } = req.query;

        const where = {};
        if (userId) where.userId = userId;
        if (exerciseId) where.exerciseId = exerciseId;
        if (programId) where.programId = programId;
        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp[Op.gte] = new Date(from);
            if (to) where.timestamp[Op.lte] = new Date(to);
        }

        const parsedLimit = parseInt(limit, 10);
        const parsedOffset = parseInt(offset, 10);
        const { rows: sessions, count: total } = await Session.findAndCountAll({
            where,
            order: [['timestamp', 'DESC']],
            limit: parsedLimit,
            offset: parsedOffset,
        });

        res.json({
            sessions,
            total,
            limit: parsedLimit,
            offset: parsedOffset,
        });
    } catch (err) {
        console.error('Error fetching sessions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/sessions
 * Save a workout session and update personal records.
 */
router.post('/', async (req, res) => {
    try {
        const {
            userId,
            exerciseId,
            programId,
            count,
            qualityScore,
            duration,
            setBreakdown,
            formErrorCount,
            formErrorDetails
        } = req.body;

        const savedSession = await Session.create({
            userId: userId || null,
            exerciseId,
            programId: programId || null,
            count,
            qualityScore,
            duration,
            setBreakdown: setBreakdown || [],
            formErrorCount: formErrorCount || 0,
            formErrorDetails: formErrorDetails || {},
        });

        // Update Personal Records
        await updatePersonalRecords(userId || null, exerciseId, count, qualityScore, duration);

        res.status(201).json(savedSession);
    } catch (err) {
        console.error('Error saving session:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/stats
 * Get aggregate stats across all sessions.
 */
router.get('/stats', async (req, res) => {
    try {
        const sessions = await getSessionsForAnalytics(req.query);

        if (sessions.length === 0) {
            return res.json({
                totalSessions: 0,
                totalReps: 0,
                totalDuration: 0,
                avgQuality: 0,
                perfectSessions: 0,
                exercisesCovered: 0,
            });
        }

        const totalReps = sessions.reduce((sum, s) => sum + (s.count || 0), 0);
        const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const avgQuality = sessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / sessions.length;
        const perfectSessions = sessions.filter((s) => (s.qualityScore || 0) >= 90).length;
        const exercisesCovered = new Set(sessions.map((s) => s.exerciseId)).size;

        res.json({
            totalSessions: sessions.length,
            totalReps,
            totalDuration,
            avgQuality: Number(avgQuality.toFixed(1)),
            perfectSessions,
            exercisesCovered,
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/streaks
 * Returns current and longest training streak.
 */
router.get('/streaks', async (req, res) => {
    try {
        const sessions = await getSessionsForAnalytics(req.query);
        const daySet = new Set(sessions.map((s) => toDayKey(s.timestamp)));
        const sortedDays = [...daySet].sort();

        if (sortedDays.length === 0) {
            return res.json({
                currentStreakDays: 0,
                longestStreakDays: 0,
                activeDays: 0,
            });
        }

        let longest = 1;
        let currentRun = 1;
        for (let i = 1; i < sortedDays.length; i += 1) {
            const prev = new Date(`${sortedDays[i - 1]}T00:00:00Z`);
            const curr = new Date(`${sortedDays[i]}T00:00:00Z`);
            const diffDays = Math.round((curr - prev) / 86400000);
            if (diffDays === 1) {
                currentRun += 1;
                longest = Math.max(longest, currentRun);
            } else {
                currentRun = 1;
            }
        }

        const todayKey = toDayKey(new Date());
        const yesterdayKey = toDayKey(new Date(Date.now() - 86400000));
        let currentStreak = 0;
        if (daySet.has(todayKey) || daySet.has(yesterdayKey)) {
            let probe = daySet.has(todayKey) ? todayKey : yesterdayKey;
            while (daySet.has(probe)) {
                currentStreak += 1;
                const probeDate = new Date(`${probe}T00:00:00Z`);
                probe = toDayKey(new Date(probeDate.getTime() - 86400000));
            }
        }

        res.json({
            currentStreakDays: currentStreak,
            longestStreakDays: longest,
            activeDays: daySet.size,
        });
    } catch (err) {
        console.error('Error fetching streaks:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/achievements
 * Milestone achievements for retention and gamification.
 */
router.get('/achievements', async (req, res) => {
    try {
        const sessions = await getSessionsForAnalytics(req.query);
        const totalSessions = sessions.length;
        const totalReps = sessions.reduce((sum, s) => sum + (s.count || 0), 0);
        const topQualitySession = sessions.reduce((max, s) => Math.max(max, s.qualityScore || 0), 0);

        const achievements = [
            { key: 'first_session', unlocked: totalSessions >= 1, threshold: 1, progress: totalSessions },
            { key: 'grind_10_sessions', unlocked: totalSessions >= 10, threshold: 10, progress: totalSessions },
            { key: 'grind_100_sessions', unlocked: totalSessions >= 100, threshold: 100, progress: totalSessions },
            { key: 'rep_beast_1k', unlocked: totalReps >= 1000, threshold: 1000, progress: totalReps },
            { key: 'rep_beast_10k', unlocked: totalReps >= 10000, threshold: 10000, progress: totalReps },
            { key: 'quality_master', unlocked: topQualitySession >= 95, threshold: 95, progress: topQualitySession },
        ];

        res.json({ achievements });
    } catch (err) {
        console.error('Error fetching achievements:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/trends
 * Weekly reps trend with a naive projection for the next week.
 */
router.get('/trends', async (req, res) => {
    try {
        const sessions = await getSessionsForAnalytics(req.query);
        const weeklyReps = {};

        sessions.forEach((session) => {
            const week = getIsoWeekKey(session.timestamp);
            weeklyReps[week] = (weeklyReps[week] || 0) + (session.count || 0);
        });

        const points = Object.entries(weeklyReps)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([week, reps]) => ({ week, reps }));

        let projectedNextWeekReps = 0;
        if (points.length >= 2) {
            const delta = points[points.length - 1].reps - points[points.length - 2].reps;
            projectedNextWeekReps = Math.max(0, points[points.length - 1].reps + delta);
        } else if (points.length === 1) {
            projectedNextWeekReps = points[0].reps;
        }

        res.json({ points, projectedNextWeekReps });
    } catch (err) {
        console.error('Error fetching trends:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/by-exercise
 * Get per-exercise breakdown stats.
 */
router.get('/by-exercise', async (req, res) => {
    try {
        const sessions = await getSessionsForAnalytics(req.query);
        const map = new Map();

        sessions.forEach((session) => {
            const curr = map.get(session.exerciseId) || {
                exerciseId: session.exerciseId,
                totalSessions: 0,
                totalReps: 0,
                qualitySum: 0,
                totalDuration: 0,
                lastPerformed: null,
            };
            curr.totalSessions += 1;
            curr.totalReps += session.count || 0;
            curr.qualitySum += session.qualityScore || 0;
            curr.totalDuration += session.duration || 0;
            curr.lastPerformed = !curr.lastPerformed || session.timestamp > curr.lastPerformed
                ? session.timestamp
                : curr.lastPerformed;
            map.set(session.exerciseId, curr);
        });

        const result = [...map.values()]
            .map((item) => ({
                exerciseId: item.exerciseId,
                totalSessions: item.totalSessions,
                totalReps: item.totalReps,
                avgQuality: Number((item.qualitySum / item.totalSessions).toFixed(1)),
                totalDuration: item.totalDuration,
                lastPerformed: item.lastPerformed,
            }))
            .sort((a, b) => b.totalReps - a.totalReps);

        res.json(result);
    } catch (err) {
        console.error('Error fetching exercise stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/sessions/history
 * Get daily workout history for streak calculation.
 * Returns list of dates with session counts.
 */
router.get('/history', async (req, res) => {
    try {
        const { days = 90 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days, 10));
        const sessions = await getSessionsForAnalytics({ ...req.query, from: startDate.toISOString() });
        const byDay = new Map();

        sessions.forEach((session) => {
            const key = toDayKey(session.timestamp);
            const curr = byDay.get(key) || {
                date: key,
                sessionCount: 0,
                totalReps: 0,
                qualitySum: 0,
            };
            curr.sessionCount += 1;
            curr.totalReps += session.count || 0;
            curr.qualitySum += session.qualityScore || 0;
            byDay.set(key, curr);
        });

        const result = [...byDay.values()]
            .map((item) => ({
                date: item.date,
                sessionCount: item.sessionCount,
                totalReps: item.totalReps,
                avgQuality: Number((item.qualitySum / item.sessionCount).toFixed(1)),
            }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));

        res.json(result);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/sessions/:id
 * Delete a specific session.
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedCount = await Session.destroy({ where: { id: req.params.id } });
        if (!deletedCount) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ message: 'Session deleted', id: req.params.id });
    } catch (err) {
        console.error('Error deleting session:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getSessionsForAnalytics(query) {
    const { userId, exerciseId, programId, from, to } = query;
    const where = {};
    if (userId) where.userId = userId;
    if (exerciseId) where.exerciseId = exerciseId;
    if (programId) where.programId = programId;
    if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp[Op.gte] = new Date(from);
        if (to) where.timestamp[Op.lte] = new Date(to);
    }
    return Session.findAll({ where, order: [['timestamp', 'DESC']] });
}

function toDayKey(dateInput) {
    const date = new Date(dateInput);
    return date.toISOString().split('T')[0];
}

function getIsoWeekKey(dateInput) {
    const date = new Date(dateInput);
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function updatePersonalRecords(userId, exerciseId, count, qualityScore, duration) {
    try {
        const [pr, created] = await PersonalRecord.findOrCreate({
            where: { userId, exerciseId },
            defaults: {
                maxReps: count,
                maxRepsDate: new Date(),
                bestQuality: qualityScore,
                bestQualityDate: new Date(),
                longestDuration: duration,
                longestDurationDate: new Date(),
                totalReps: count,
                totalSessions: 1,
                lastPerformedAt: new Date(),
            },
        });

        if (!created) {
            if (count > pr.maxReps) {
                pr.maxReps = count;
                pr.maxRepsDate = new Date();
            }
            if (qualityScore > pr.bestQuality) {
                pr.bestQuality = qualityScore;
                pr.bestQualityDate = new Date();
            }
            if (duration > pr.longestDuration) {
                pr.longestDuration = duration;
                pr.longestDurationDate = new Date();
            }
            pr.totalReps += count;
            pr.totalSessions += 1;
            pr.lastPerformedAt = new Date();
            await pr.save();
        }
    } catch (err) {
        console.error('Error updating personal records:', err);
    }
}

module.exports = router;
