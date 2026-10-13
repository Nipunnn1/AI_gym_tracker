const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const PersonalRecord = require('../models/PersonalRecord');
const { getAIAdvice, generateCustomProgram } = require('../services/aiCoach');

/**
 * GET /api/coaching/advice
 * Analyzes previous performance and returns AI coaching feedback.
 */
router.get('/advice', async (req, res) => {
    try {
        const { userId } = req.query;
        // Fetch last 10 sessions and all PRs to give context to AI
        const sessionWhere = {};
        const prWhere = {};
        if (userId) {
            sessionWhere.userId = userId;
            prWhere.userId = userId;
        }
        const sessions = await Session.findAll({
            where: sessionWhere,
            order: [['timestamp', 'DESC']],
            limit: 10,
        });
        const prs = await PersonalRecord.findAll({ where: prWhere });

        if (sessions.length === 0) {
            return res.json({ 
                advice: "Welcome! Complete your first workout to get personalized AI coaching and form analysis. 🚀" 
            });
        }

        const advice = await getAIAdvice(sessions, prs);
        res.json({ advice });
    } catch (err) {
        console.error('Coaching Route Error:', err);
        res.status(500).json({ error: 'AI Coach is busy, try again soon.' });
    }
});

/**
 * POST /api/coaching/generate-program
 * Generates a tailored workout plan using Gemini.
 * Body: { goal, timeAvailable, difficulty }
 */
router.post('/generate-program', async (req, res) => {
    try {
        const { goal, timeAvailable, difficulty } = req.body;
        
        if (!goal || !timeAvailable || !difficulty) {
            return res.status(400).json({ error: 'Missing program parameters' });
        }

        const program = await generateCustomProgram(goal, timeAvailable, difficulty);
        
        if (!program) {
            return res.status(500).json({ error: 'Failed to generate program' });
        }

        res.json(program);
    } catch (err) {
        console.error('Program Generation Route Error:', err);
        res.status(500).json({ error: 'AI failed to design your program.' });
    }
});

module.exports = router;
