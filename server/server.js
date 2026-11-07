const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

// Routes
const sessionRoutes = require('./routes/sessions');
const workoutLogRoutes = require('./routes/workoutLogs');
const personalRecordRoutes = require('./routes/personalRecords');
const coachingRoutes = require('./routes/coaching');
const growthRoutes = require('./routes/growth');
const nutritionRoutes = require('./routes/nutrition');

const sequelize = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection (cached so serverless invocations reuse it)
let dbReady = null;
function connectDatabase() {
    if (!dbReady) {
        dbReady = sequelize.authenticate()
            .then(() => sequelize.sync())
            .then(() => console.log('✅ Postgres Connected'))
            .catch((err) => {
                dbReady = null;
                throw err;
            });
    }
    return dbReady;
}

// Ensure the database is connected before handling API requests
app.use('/api', async (req, res, next) => {
    try {
        await connectDatabase();
        next();
    } catch (err) {
        console.error('❌ Postgres Connection Error:', err);
        res.status(503).json({ error: 'Database unavailable' });
    }
});

// Register Modular Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/workout-logs', workoutLogRoutes);
app.use('/api/personal-records', personalRecordRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/nutrition', nutritionRoutes);


// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'active', 
        engine: 'AI Gym Trainer Pro Backend',
        version: '2.0.0',
        platform: 'Next-Gen SaaS'
    });
});

// Start Server (local only; on Vercel the exported app is used)
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    connectDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`🚀 AI Gym Trainer Server running on port ${PORT}`);
            });
        })
        .catch((err) => {
            console.error('❌ Postgres Connection Error:', err);
            process.exit(1);
        });
}

module.exports = app;
