const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const {
    getNutrition
} = require('../services/nutritionLookup');

const router = express.Router();

// ==========================================
// PROJECT PATHS
// ==========================================

const projectRoot = path.resolve(__dirname, '../..');

const nutritionDir = path.join(projectRoot, 'nutrition');

const uploadDir = path.join(nutritionDir, 'uploads');

const pythonScript = path.join(nutritionDir, 'yolo.py');

const modelPath = path.join(nutritionDir, 'best.pt');

// Python environment containing Ultralytics
const pythonPath = path.join(
    process.env.USERPROFILE || '',
    'Documents',
    'Smart-AI-Gym-Trainer-With-RealTime-Exercise-Tracking-and-Nutrition-Assistant',
    'venv312',
    'Scripts',
    'python.exe'
);

// Create upload directory if it does not exist
fs.mkdirSync(uploadDir, { recursive: true });


// ==========================================
// MULTER IMAGE UPLOAD CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDir);
    },

    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const safeExtension = [
            '.jpg',
            '.jpeg',
            '.png',
            '.webp',
            '.bmp',
            '.tif',
            '.tiff',
            '.avif',
            '.heic',
            '.heif',
            '.jp2',
            '.dng',
            '.mpo'
        ].includes(extension)
            ? extension
            : '.jpg';

        const filename =
            `${Date.now()}-${Math.random().toString(36).slice(2)}` +
            safeExtension;

        callback(null, filename);
    }
});

// Accept image uploads up to 10 MB
const upload = multer({
    storage,

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

        modelExists: fs.existsSync(modelPath),

        pythonExists: fs.existsSync(pythonPath),

        scriptExists: fs.existsSync(pythonScript)
    });
});


// ==========================================
// FOOD DETECTION + NUTRITION API
// ==========================================

router.post(
    '/detect',
    upload.single('image'),
    (req, res) => {

        // Check whether an image was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded. Use the form field named image.'
            });
        }

        const imagePath = req.file.path;

        // Check uploaded image
        if (!fs.existsSync(imagePath)) {
            return res.status(400).json({
                success: false,
                error: 'Uploaded image could not be found.'
            });
        }

        // Check YOLO Python script
        if (!fs.existsSync(pythonScript)) {
            fs.unlink(imagePath, () => {});

            return res.status(500).json({
                success: false,
                error: 'YOLO Python script not found.',
                expectedPath: pythonScript
            });
        }

        // Check YOLO model
        if (!fs.existsSync(modelPath)) {
            fs.unlink(imagePath, () => {});

            return res.status(500).json({
                success: false,
                error: 'YOLO model best.pt not found.',
                expectedPath: modelPath
            });
        }

        // Check Python environment
        if (!fs.existsSync(pythonPath)) {
            fs.unlink(imagePath, () => {});

            return res.status(500).json({
                success: false,
                error: 'Python environment not found.',
                expectedPath: pythonPath
            });
        }

        console.log('Nutrition image:', imagePath);

        console.log('YOLO script:', pythonScript);

        console.log('Python executable:', pythonPath);


        // ==========================================
        // RUN YOLO FOOD DETECTION
        // ==========================================

        execFile(
            pythonPath,

            [pythonScript, imagePath],

            {
                cwd: nutritionDir,

                timeout: 120000,

                maxBuffer: 10 * 1024 * 1024,

                windowsHide: true
            },

            (error, stdout, stderr) => {

                // Delete temporary uploaded image
                fs.unlink(imagePath, (unlinkError) => {
                    if (unlinkError) {
                        console.warn(
                            'Could not delete uploaded image:',
                            unlinkError.message
                        );
                    }
                });

                if (stderr && stderr.trim()) {
                    console.log(
                        'YOLO stderr:',
                        stderr
                    );
                }

                // Handle YOLO execution errors
                if (error) {
                    console.error(
                        'YOLO execution error:',
                        error.message
                    );

                    console.error(
                        'YOLO stdout:',
                        stdout
                    );

                    return res.status(500).json({
                        success: false,

                        error: 'Food detection failed.',

                        details: stderr.trim() || error.message
                    });
                }


                // ==========================================
                // PARSE YOLO OUTPUT
                // ==========================================

                try {
                    const output = stdout.trim();

                    if (!output) {
                        throw new Error(
                            'YOLO returned an empty response.'
                        );
                    }

                    const result = JSON.parse(output);

                    // Handle errors returned by Python
                    if (result.success === false) {
                        return res.status(500).json(result);
                    }

                    // Get detections from YOLO
                    const detections = result.detections || [];


                    // ==========================================
                    // MATCH DETECTED FOOD WITH CSV
                    // ==========================================

                    const enrichedDetections = detections.map(
                        (detection) => {

                            // YOLO returns the detected name in "food"
                            const foodName = detection.food;

                            // Search the nutrition CSV
                            const nutrition = getNutrition(foodName);

                            // Return food detection and nutrition
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
                        }
                    );


                    // ==========================================
                    // SEND FINAL API RESPONSE
                    // ==========================================

                    return res.json({
                        success: true,

                        detections: enrichedDetections
                    });

                } catch (parseError) {
                    console.error(
                        'YOLO output parsing error:',
                        parseError.message
                    );

                    console.error(
                        'Raw YOLO output:',
                        stdout
                    );

                    return res.status(500).json({
                        success: false,

                        error: 'Could not parse YOLO detection results.',

                        details: parseError.message
                    });
                }
            }
        );
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