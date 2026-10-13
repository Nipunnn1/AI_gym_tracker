const express = require('express');
const { Op } = require('sequelize');
const Session = require('../models/Session');

const router = express.Router();

function computeReadinessScore(recentSessions) {
    if (recentSessions.length === 0) {
        return {
            score: 78,
            status: 'fresh',
            reason: 'No recent fatigue load. Great day to start a solid session.',
        };
    }

    const avgQuality = recentSessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / recentSessions.length;
    const avgDuration = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSessions.length;
    const loadPenalty = Math.min(25, Math.round(recentSessions.length * 2 + avgDuration / 120));
    const qualityBoost = Math.round((avgQuality - 75) / 2);
    const score = Math.max(35, Math.min(98, 72 + qualityBoost - loadPenalty));

    let status = 'ready';
    if (score < 50) status = 'recover';
    else if (score > 80) status = 'peak';

    const reason = status === 'recover'
        ? 'Recent training load is high. Use a lighter form-focused workout today.'
        : status === 'peak'
            ? 'Readiness is high. Ideal day for a high-output workout.'
            : 'You are in a stable training window. Progress with moderate intensity.';

    return { score, status, reason };
}

router.get('/daily-mission', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = {};
        if (userId) where.userId = userId;

        const weekAgo = new Date(Date.now() - 7 * 86400000);
        const sessions = await Session.findAll({
            where: {
                ...where,
                timestamp: { [Op.gte]: weekAgo },
            },
            order: [['timestamp', 'DESC']],
        });

        const totalReps = sessions.reduce((sum, s) => sum + (s.count || 0), 0);
        const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
        const qualityAvg = sessions.length
            ? Math.round(sessions.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / sessions.length)
            : 75;
        const dailyRepsBaseline = Math.max(40, Math.round(totalReps / 7));
        const dailyMinutesBaseline = Math.max(10, Math.round(totalMinutes / 7));

        res.json({
            missionTitle: 'Daily Domination',
            repsGoal: Math.round(dailyRepsBaseline * 1.2),
            minutesGoal: Math.round(dailyMinutesBaseline * 1.15),
            qualityGoal: Math.min(96, Math.max(80, qualityAvg + 2)),
            rewardXp: 120,
        });
    } catch (err) {
        console.error('Error creating daily mission:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/ghost-target', async (req, res) => {
    try {
        const { userId, exerciseId } = req.query;
        if (!exerciseId) {
            return res.status(400).json({ error: 'exerciseId is required' });
        }

        const where = { exerciseId };
        if (userId) where.userId = userId;

        const topSession = await Session.findOne({
            where,
            order: [['count', 'DESC'], ['qualityScore', 'DESC']],
        });

        if (!topSession) {
            return res.json({
                exerciseId,
                targetReps: 10,
                targetQuality: 80,
                challengeText: 'Set your first benchmark and unlock ghost mode.',
            });
        }

        res.json({
            exerciseId,
            targetReps: Math.max(1, Math.round(topSession.count * 1.05)),
            targetQuality: Math.min(99, Math.round(topSession.qualityScore)),
            challengeText: `Beat your best ${topSession.count} reps at ${Math.round(topSession.qualityScore)}% quality.`,
        });
    } catch (err) {
        console.error('Error fetching ghost target:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/comeback-plan', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = {};
        if (userId) where.userId = userId;

        const latest = await Session.findOne({
            where,
            order: [['timestamp', 'DESC']],
        });

        if (!latest) {
            return res.json({
                status: 'new',
                daysInactive: 0,
                headline: 'Start your first streak today.',
                actions: ['Do 1 quick 10-minute session', 'Hit 80% quality', 'Save your first workout'],
            });
        }

        const daysInactive = Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 86400000);
        const status = daysInactive >= 3 ? 'comeback_needed' : 'active';

        res.json({
            status,
            daysInactive,
            headline: status === 'comeback_needed'
                ? `Time for a comeback. You are ${daysInactive} days out.`
                : 'You are active. Protect your streak.',
            actions: status === 'comeback_needed'
                ? ['Start with 8-12 mins', 'Choose easiest exercise first', 'Finish one session before midnight']
                : ['Keep daily consistency', 'Push one extra set', 'Target 90%+ form quality'],
        });
    } catch (err) {
        console.error('Error fetching comeback plan:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const { exerciseId } = req.query;
        const where = {};
        if (exerciseId) where.exerciseId = exerciseId;

        const sessions = await Session.findAll({
            where,
            order: [['count', 'DESC']],
            limit: 300,
        });

        const byUser = new Map();
        sessions.forEach((session) => {
            const userKey = session.userId || 'solo-athlete';
            const curr = byUser.get(userKey) || {
                userId: userKey,
                totalReps: 0,
                avgQualitySeed: 0,
                entries: 0,
            };
            curr.totalReps += session.count || 0;
            curr.avgQualitySeed += session.qualityScore || 0;
            curr.entries += 1;
            byUser.set(userKey, curr);
        });

        const leaderboard = [...byUser.values()]
            .map((item) => ({
                userId: item.userId,
                totalReps: item.totalReps,
                avgQuality: Number((item.avgQualitySeed / Math.max(1, item.entries)).toFixed(1)),
            }))
            .sort((a, b) => b.totalReps - a.totalReps)
            .slice(0, 10)
            .map((item, index) => ({ rank: index + 1, ...item }));

        res.json({ leaderboard });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/readiness', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = {};
        if (userId) where.userId = userId;

        const last72Hours = new Date(Date.now() - 72 * 3600000);
        const recentSessions = await Session.findAll({
            where: {
                ...where,
                timestamp: { [Op.gte]: last72Hours },
            },
            order: [['timestamp', 'DESC']],
        });

        const readiness = computeReadinessScore(recentSessions);
        res.json({
            readinessScore: readiness.score,
            status: readiness.status,
            explanation: readiness.reason,
            recentSessionCount: recentSessions.length,
        });
    } catch (err) {
        console.error('Error fetching readiness:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/smart-plan', async (req, res) => {
    try {
        const { userId, goal = 'balanced' } = req.query;
        const where = {};
        if (userId) where.userId = userId;

        const last30Days = new Date(Date.now() - 30 * 86400000);
        const sessions = await Session.findAll({
            where: {
                ...where,
                timestamp: { [Op.gte]: last30Days },
            },
            order: [['timestamp', 'DESC']],
        });

        const repsByExercise = {};
        sessions.forEach((s) => {
            repsByExercise[s.exerciseId] = (repsByExercise[s.exerciseId] || 0) + (s.count || 0);
        });

        const lowVolumeExercises = Object.entries(repsByExercise)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3)
            .map(([exerciseId]) => exerciseId);

        const fallback = ['squat', 'pushup', 'curl'];
        const anchors = lowVolumeExercises.length ? lowVolumeExercises : fallback;

        const planByGoal = {
            strength: { sets: 4, targetReps: 8, restSeconds: 75, focus: 'higher intensity' },
            fat_loss: { sets: 3, targetReps: 16, restSeconds: 30, focus: 'short-rest metabolic burn' },
            balanced: { sets: 3, targetReps: 12, restSeconds: 45, focus: 'balanced progression' },
        };
        const key = planByGoal[goal] ? goal : 'balanced';
        const frame = planByGoal[key];

        res.json({
            goal: key,
            headline: `AI Smart Plan: ${frame.focus}`,
            estimatedMinutes: key === 'fat_loss' ? 18 : 22,
            exercises: anchors.map((exerciseId) => ({
                exerciseId,
                sets: frame.sets,
                targetReps: frame.targetReps,
                restSeconds: frame.restSeconds,
            })),
            premiumNudge: {
                title: 'Upgrade to Pro Coaching',
                value: 'Unlock weekly auto-adjusting programs and voice coaching.',
            },
        });
    } catch (err) {
        console.error('Error generating smart plan:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/monetization-signals', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = {};
        if (userId) where.userId = userId;

        const last14Days = new Date(Date.now() - 14 * 86400000);
        const sessions = await Session.findAll({
            where: { ...where, timestamp: { [Op.gte]: last14Days } },
            order: [['timestamp', 'DESC']],
        });

        const workouts = sessions.length;
        const avgQuality = workouts ? Math.round(sessions.reduce((s, x) => s + (x.qualityScore || 0), 0) / workouts) : 0;
        const engaged = workouts >= 6;

        res.json({
            conversionLikelihood: engaged ? 'high' : 'medium',
            triggers: [
                workouts >= 4 ? 'consistency_streak' : 'new_habit_building',
                avgQuality >= 85 ? 'performance_oriented' : 'guidance_needed',
            ],
            recommendedOffer: engaged
                ? '7-day Pro trial: adaptive plans + advanced analytics'
                : 'Starter pack: form insights + structured weekly plan',
        });
    } catch (err) {
        console.error('Error generating monetization signals:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
