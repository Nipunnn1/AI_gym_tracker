const express = require('express');
const multer = require('multer');
const fs = require('fs');

const {
    getNutrition
} = require('../services/nutritionLookup');

const {
    detectFood,
    MODEL_PATH
} = require('../services/foodDetector');

const router = express.Router();


// ==========================================
// MULTER IMAGE UPLOAD CONFIGURATION
// ==========================================

// Images are kept in memory: the ONNX detector reads the buffer directly,
// and Vercel's filesystem is read-only anyway.
const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {
        if (
            !file.mimetype ||
            !file.mimetype.startsWith('image/')
        ) {
            return callback(
                new Error('Please upload a valid image.')
            );
        }

        callback(null, true);
    }
});


// ==========================================
// HEALTH CHECK API
// ==========================================

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Nutrition API is running',

        modelExists: fs.existsSync(MODEL_PATH),

        runtime: 'onnxruntime-web'
    });
});


// ==========================================
// FOOD DETECTION + NUTRITION API
// ==========================================

router.post(
    '/detect',
    upload.single('image'),
    async (req, res) => {

        // Check whether an image was uploaded
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded. Use the form field named image.'
            });
        }

        // ==========================================
        // RUN YOLO FOOD DETECTION (ONNX)
        // ==========================================

        let detections;

        try {
            detections = await detectFood(req.file.buffer);
        } catch (error) {
            console.error('Food detection error:', error);

            return res.status(500).json({
                success: false,
                error: 'Food detection failed.',
                details: error.message
            });
        }


        // ==========================================
        // MATCH DETECTED FOOD WITH CSV
        // ==========================================

        const enrichedDetections = detections.map((detection) => {
            const foodName = detection.food;

            // Search the nutrition CSV
            const nutrition = getNutrition(foodName);

            if (nutrition.found) {
                return {
                    food: foodName,
                    confidence: detection.confidence,
                    nutrition: {
                        found: true,
                        calories: nutrition.calories,
                        protein: nutrition.protein,
                        carbohydrates: nutrition.carbohydrates,
                        fats: nutrition.fats
                    }
                };
            }

            // Return detection even when nutrition
            // is unavailable in the CSV
            return {
                food: foodName,
                confidence: detection.confidence,
                nutrition: {
                    found: false,
                    message: nutrition.message
                }
            };
        });


        // ==========================================
        // SEND FINAL API RESPONSE
        // ==========================================

        return res.json({
            success: true,
            detections: enrichedDetections
        });
    }
);


// ==========================================
// HANDLE UPLOAD ERRORS
// ==========================================

router.use((err, req, res, next) => {

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Image upload failed.'
        });
    }

    next();
});


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
