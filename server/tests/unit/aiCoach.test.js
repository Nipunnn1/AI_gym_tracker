/**
 * UNIT TESTS — services/aiCoach
 *
 * Why: this service wraps an external, paid, non-deterministic API (Gemini).
 * Unit tests replace the SDK with a mock so we can check prompt contents,
 * JSON extraction and every failure path without network calls or cost.
 */
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
    })),
}));

const { getAIAdvice, generateCustomProgram } = require('../../services/aiCoach');

const reply = (text) => ({ response: { text: () => text } });
const sessions = [{ exerciseId: 'squat', count: 12, qualityScore: 88, formErrorCount: 3 }];
const prs = [{ exerciseId: 'squat', maxReps: 20, bestQuality: 95 }];

beforeEach(() => {
    mockGenerateContent.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    process.env.GEMINI_API_KEY = '';
    console.error.mockRestore();
});

describe('without GEMINI_API_KEY (production default)', () => {
    test('getAIAdvice returns the demo-mode message and never calls Gemini', async () => {
        await expect(getAIAdvice(sessions, prs)).resolves.toMatch(/demo mode/);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    test('generateCustomProgram returns null', async () => {
        await expect(generateCustomProgram('strength', 20, 'beginner')).resolves.toBeNull();
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });
});

describe('with GEMINI_API_KEY', () => {
    beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; });

    test('getAIAdvice sends session + PR data and returns the model text', async () => {
        mockGenerateContent.mockResolvedValue(reply('Great job!'));
        await expect(getAIAdvice(sessions, prs)).resolves.toBe('Great job!');
        const prompt = mockGenerateContent.mock.calls[0][0];
        expect(prompt).toContain('"exercise":"squat"');
        expect(prompt).toContain('"errors":3');
        expect(prompt).toContain('"bestReps":20');
    });

    test('getAIAdvice degrades gracefully when Gemini fails', async () => {
        mockGenerateContent.mockRejectedValue(new Error('quota'));
        await expect(getAIAdvice(sessions, prs)).resolves.toMatch(/taking a breather/);
    });

    test('generateCustomProgram extracts JSON wrapped in markdown fences', async () => {
        const program = { name: 'P', description: 'd', exercises: [{ exerciseId: 'squat', sets: 3, targetReps: 10, restSeconds: 60 }] };
        mockGenerateContent.mockResolvedValue(reply('Here you go:\n```json\n' + JSON.stringify(program) + '\n```'));
        await expect(generateCustomProgram('strength', 20, 'beginner')).resolves.toEqual(program);
        expect(mockGenerateContent.mock.calls[0][0]).toMatch(/Goal: strength[\s\S]*20 minutes[\s\S]*Difficulty: beginner/);
    });

    test('generateCustomProgram returns null when there is no JSON', async () => {
        mockGenerateContent.mockResolvedValue(reply('Sorry, I cannot help.'));
        await expect(generateCustomProgram('x', 10, 'beginner')).resolves.toBeNull();
    });

    test('generateCustomProgram returns null on malformed JSON', async () => {
        mockGenerateContent.mockResolvedValue(reply('{ "name": "oops", }'));
        await expect(generateCustomProgram('x', 10, 'beginner')).resolves.toBeNull();
    });

    test('generateCustomProgram returns null when Gemini throws', async () => {
        mockGenerateContent.mockRejectedValue(new Error('network'));
        await expect(generateCustomProgram('x', 10, 'beginner')).resolves.toBeNull();
    });
});
