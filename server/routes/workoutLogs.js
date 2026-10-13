const express = require('express');
const router = express.Router();
const WorkoutLog = require('../models/WorkoutLog');

/**
 * GET /api/workout-logs
 * Fetch completed workout program logs.
 *
 * Query params:
 *  - programId: filter by program
 *  - limit: max results (default 20)
 *  - offset: pagination offset
 */
router.get('/', async (req, res) => {
    try {
        const { userId, programId, limit = 20, offset = 0 } = req.query;

        const where = {};
        if (userId) where.userId = userId;
        if (programId) where.programId = programId;
        const parsedLimit = parseInt(limit, 10);
        const parsedOffset = parseInt(offset, 10);
        const { rows: logs, count: total } = await WorkoutLog.findAndCountAll({
            where,
            order: [['completedAt', 'DESC']],
            limit: parsedLimit,
            offset: parsedOffset,
        });

        res.json({ logs, total });
    } catch (err) {
        console.error('Error fetching workout logs:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/workout-logs
 * Save a completed workout program log.
 * Body: { programId, programName, totalReps, qualityScore, durationSeconds, exerciseBreakdown, formErrors, completed }
 */
router.post('/', async (req, res) => {
    try {
        const {
            userId,
            programId,
            programName,
            totalReps,
            qualityScore,
            durationSeconds,
            exerciseBreakdown,
            formErrors,
            completed,
        } = req.body;

        const saved = await WorkoutLog.create({
            userId: userId || null,
            programId,
            programName,
            totalReps,
            qualityScore,
            durationSeconds,
            exerciseBreakdown: exerciseBreakdown || {},
            formErrors: formErrors || {},
            completed: completed !== undefined ? completed : true,
        });

        res.status(201).json(saved);
    } catch (err) {
        console.error('Error saving workout log:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/workout-logs/stats
 * Aggregate stats across all completed workout programs.
 */
router.get('/stats', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = { completed: true };
        if (userId) where.userId = userId;
        const logs = await WorkoutLog.findAll({ where });

        if (logs.length === 0) {
            return res.json({
                programsCompleted: 0,
                totalReps: 0,
                totalDurationSeconds: 0,
                avgQuality: 0,
                uniqueProgramCount: 0,
            });
        }

        const totalReps = logs.reduce((sum, l) => sum + (l.totalReps || 0), 0);
        const totalDurationSeconds = logs.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
        const avgQuality = logs.reduce((sum, l) => sum + (l.qualityScore || 0), 0) / logs.length;
        const uniqueProgramCount = new Set(logs.map((l) => l.programId)).size;

        res.json({
            programsCompleted: logs.length,
            totalReps,
            totalDurationSeconds,
            avgQuality: Number(avgQuality.toFixed(1)),
            uniqueProgramCount,
        });
    } catch (err) {
        console.error('Error fetching workout log stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/workout-logs/by-program
 * Per-program completion summary.
 */
router.get('/by-program', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = { completed: true };
        if (userId) where.userId = userId;
        const logs = await WorkoutLog.findAll({ where, order: [['completedAt', 'DESC']] });
        const byProgram = new Map();

        logs.forEach((log) => {
            const curr = byProgram.get(log.programId) || {
                programId: log.programId,
                programName: log.programName,
                timesCompleted: 0,
                qualitySum: 0,
                totalReps: 0,
                lastCompletedAt: null,
            };
            curr.timesCompleted += 1;
            curr.qualitySum += log.qualityScore || 0;
            curr.totalReps += log.totalReps || 0;
            curr.lastCompletedAt = !curr.lastCompletedAt || log.completedAt > curr.lastCompletedAt
                ? log.completedAt
                : curr.lastCompletedAt;
            byProgram.set(log.programId, curr);
        });

        const result = [...byProgram.values()]
            .map((item) => ({
                programId: item.programId,
                programName: item.programName,
                timesCompleted: item.timesCompleted,
                avgQuality: Number((item.qualitySum / item.timesCompleted).toFixed(1)),
                totalReps: item.totalReps,
                lastCompletedAt: item.lastCompletedAt,
            }))
            .sort((a, b) => b.timesCompleted - a.timesCompleted);

        res.json(result);
    } catch (err) {
        console.error('Error fetching by-program stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
