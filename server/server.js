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

const sequelize = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
async function connectDatabase() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('✅ Postgres Connected');
    } catch (err) {
        console.error('❌ Postgres Connection Error:', err);
        process.exit(1);
    }
}

// Register Modular Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/workout-logs', workoutLogRoutes);
app.use('/api/personal-records', personalRecordRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/growth', growthRoutes);


// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'active', 
        engine: 'AI Gym Trainer Pro Backend',
        version: '2.0.0',
        platform: 'Next-Gen SaaS'
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
connectDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 AI Gym Trainer Server running on port ${PORT}`);
    });
});

