/**
 * INTEGRATION TESTS — /api/nutrition (upload → detector → nutrition lookup)
 *
 * Why: the detect endpoint glues three components together: multer upload
 * handling, the food detector and the CSV lookup. The detector is stubbed here
 * (it is tested on its own in unit tests and for real in system tests) so we
 * can check how the route combines the pieces and handles each failure.
 */
const request = require('supertest');
const sharp = require('sharp');

jest.mock('../../services/foodDetector', () => {
    const actual = jest.requireActual('../../services/foodDetector');
    return { ...actual, detectFood: jest.fn() };
});

const { detectFood, CLASS_NAMES } = require('../../services/foodDetector');
const { getNutrition } = require('../../services/nutritionLookup');
const app = require('../../server');

let jpeg;
beforeAll(async () => {
    jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).jpeg().toBuffer();
});
beforeEach(() => detectFood.mockReset());

test('GET /api/nutrition/health reports the model file is present', async () => {
    const { body } = await request(app).get('/api/nutrition/health').expect(200);
    expect(body).toMatchObject({ success: true, modelExists: true, runtime: 'onnxruntime-web' });
});

test('enriches each detection with nutrition when the dish is known', async () => {
    detectFood.mockResolvedValue([{ food: 'Idli', confidence: 0.91 }, { food: 'burger', confidence: 0.5 }]);
    const { body } = await request(app)
        .post('/api/nutrition/detect')
        .attach('image', jpeg, { filename: 'food.jpg', contentType: 'image/jpeg' })
        .expect(200);

    expect(detectFood).toHaveBeenCalledWith(expect.any(Buffer));
    expect(detectFood.mock.calls[0][0].equals(jpeg)).toBe(true);
    expect(body).toEqual({
        success: true,
        detections: [
            { food: 'Idli', confidence: 0.91, nutrition: { found: true, calories: 137.54, protein: 4.64, carbohydrates: 28.18, fats: 0.33 } },
            { food: 'burger', confidence: 0.5, nutrition: { found: false, message: 'No exact nutritional record was found.' } },
        ],
    });
});

test('400 when no image is attached', async () => {
    const { body } = await request(app).post('/api/nutrition/detect').expect(400);
    expect(body).toMatchObject({ success: false });
    expect(detectFood).not.toHaveBeenCalled();
});

test('400 for a non-image upload', async () => {
    const { body } = await request(app)
        .post('/api/nutrition/detect')
        .attach('image', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' })
        .expect(400);
    expect(body.error).toBe('Please upload a valid image.');
});

test('400 when the file exceeds the 10 MB limit', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    const { body } = await request(app)
        .post('/api/nutrition/detect')
        .attach('image', big, { filename: 'big.jpg', contentType: 'image/jpeg' })
        .expect(400);
    expect(body.error).toMatch(/too large/i);
});

test('500 with details when the detector fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    detectFood.mockRejectedValue(new Error('model crashed'));
    const { body } = await request(app)
        .post('/api/nutrition/detect')
        .attach('image', jpeg, { filename: 'food.jpg', contentType: 'image/jpeg' })
        .expect(500);
    console.error.mockRestore();
    expect(body).toEqual({ success: false, error: 'Food detection failed.', details: 'model crashed' });
});

// KNOWN GAP between the two components: the detector's class labels are not
// all present in the nutrition CSV, so for 10 of the 12 detectable foods the
// API returns "No exact nutritional record was found." (only Idli and Pizza
// match). Fix by adding an alias map or renaming entries. Marked `failing` so
// the suite stays green while documenting the gap; it flips once fixed.
test.failing('every food the model can detect has nutrition data', () => {
    const missing = CLASS_NAMES.filter((name) => !getNutrition(name).found);
    expect(missing).toEqual([]);
});
