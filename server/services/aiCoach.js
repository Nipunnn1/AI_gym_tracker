const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * AI Coaching Engine
 * Uses Gemini to analyze workout data and provide personalized feedback.
 */

/**
 * Generates recovery and form advice based on session history.
 */
async function getAIAdvice(sessions, userPRs) {
    if (!process.env.GEMINI_API_KEY) {
        return "AI Coaching is currently in demo mode. Add GEMINI_API_KEY to enable full analysis.";
    }

    const prompt = `
    You are an expert AI Gym Coach. Analyze the following workout data for a user and provide:
    1. A summary of their progress.
    2. Specific form correction advice based on their form errors.
    3. Recommendations for their next workout to avoid plateauing.

    Workout History (Last 10 sessions):
    ${JSON.stringify(sessions.map(s => ({
        exercise: s.exerciseId,
        reps: s.count,
        quality: s.qualityScore,
        errors: s.formErrorCount
    })))}

    Personal Records:
    ${JSON.stringify(userPRs.map(pr => ({
        exercise: pr.exerciseId,
        bestReps: pr.maxReps,
        bestQuality: pr.bestQuality
    })))}

    Keep the tone motivating but professional. Focus on biomechanical efficiency.
    Return the response in concise markdown format with emojis.
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err) {
        console.error("AI Coach Error:", err);
        return "The AI Coach is currently taking a breather. Please try again later.";
    }
}

/**
 * Generates a custom workout program based on user goals.
 */
async function generateCustomProgram(goal, timeAvailable, difficulty) {
    if (!process.env.GEMINI_API_KEY) return null;

    const prompt = `
    Create a custom workout program for a user with the following profile:
    - Goal: ${goal}
    - Time Available: ${timeAvailable} minutes
    - Difficulty: ${difficulty}

    Choose from these available exercises: 
    curl, overhead_press, lateral_raise, tricep_extension, squat, lunge, calf_raise, crunch, leg_raise, pushup, jumping_jack, high_knee.

    Return the program in a JSON format matching this structure:
    {
        "name": "Program Name",
        "description": "Brief description",
        "exercises": [
            { "exerciseId": "id", "sets": 3, "targetReps": 12, "restSeconds": 60 }
        ]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Extract JSON from the response (sometimes Gemini adds markdown ticks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
        console.error("AI Program Gen Error:", err);
        return null;
    }
}

module.exports = {
    getAIAdvice,
    generateCustomProgram
};
