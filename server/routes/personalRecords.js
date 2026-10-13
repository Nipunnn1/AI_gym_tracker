const express = require('express');
const router = express.Router();
const PersonalRecord = require('../models/PersonalRecord');

/**
 * GET /api/personal-records
 * Fetch all personal records for the user.
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        const where = {};
        if (userId) where.userId = userId;
        const records = await PersonalRecord.findAll({
            where,
            order: [['exerciseId', 'ASC']],
        });
        res.json(records);
    } catch (err) {
        console.error('Error fetching personal records:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/personal-records/:exerciseId
 * Fetch PR for a specific exercise.
 */
router.get('/:exerciseId', async (req, res) => {
    try {
        const where = { exerciseId: req.params.exerciseId };
        if (req.query.userId) where.userId = req.query.userId;
        const record = await PersonalRecord.findOne({ where });
        if (!record) {
            return res.status(404).json({ error: 'No record found for this exercise' });
        }
        res.json(record);
    } catch (err) {
        console.error('Error fetching PR for exercise:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/personal-records/:exerciseId
 * Reset PR for a specific exercise.
 */
router.delete('/:exerciseId', async (req, res) => {
    try {
        const where = { exerciseId: req.params.exerciseId };
        if (req.query.userId) where.userId = req.query.userId;
        const deleted = await PersonalRecord.destroy({ where });
        if (deleted === 0) {
            return res.status(404).json({ error: 'No record found to delete' });
        }
        res.json({ message: 'Personal record reset' });
    } catch (err) {
        console.error('Error deleting personal record:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
