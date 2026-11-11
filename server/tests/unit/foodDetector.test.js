/**
 * UNIT TESTS — services/foodDetector (ONNX runtime mocked)
 *
 * Why: the detector hand-ports Ultralytics' pre/post-processing (letterboxing,
 * confidence threshold, per-class NMS). Those are easy to get subtly wrong and
 * impossible to verify through the real model's opaque output. By mocking the
 * ONNX session we feed exact tensors in and check exactly which boxes survive.
 * The real model is exercised in the system tests.
 */
const sharp = require('sharp');

const mockRun = jest.fn();
const mockCreate = jest.fn(async () => ({ inputNames: ['images'], outputNames: ['output0'], run: mockRun }));

jest.mock('onnxruntime-web', () => ({
    env: { wasm: {} },
    Tensor: class {
        constructor(type, data, dims) { Object.assign(this, { type, data, dims }); }
    },
    InferenceSession: { create: (...args) => mockCreate(...args) },
}));

const { detectFood, CLASS_NAMES } = require('../../services/foodDetector');

const NUM_CLASSES = CLASS_NAMES.length;

/** Builds a YOLOv8-style output tensor [1, 4 + classes, anchors]. */
function yoloOutput(anchors) {
    const n = anchors.length;
    const data = new Float32Array((4 + NUM_CLASSES) * n);
    anchors.forEach(({ box: [cx, cy, w, h], scores }, a) => {
        data[a] = cx; data[n + a] = cy; data[2 * n + a] = w; data[3 * n + a] = h;
        Object.entries(scores).forEach(([cls, s]) => { data[(4 + Number(cls)) * n + a] = s; });
    });
    return { output0: { dims: [1, 4 + NUM_CLASSES, n], data } };
}

const IDLI = CLASS_NAMES.indexOf('Idli');
const PIZZA = CLASS_NAMES.indexOf('Pizza');

let image;
beforeAll(async () => {
    image = await sharp({ create: { width: 320, height: 160, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
});
beforeEach(() => mockRun.mockReset());

test('exposes the 12 trained classes in model order', () => {
    expect(CLASS_NAMES).toHaveLength(12);
    expect(CLASS_NAMES[0]).toBe('Apple');
    expect(CLASS_NAMES[11]).toBe('burger');
});

test('preprocesses into a letterboxed 1x3x640x640 float tensor in [0,1]', async () => {
    mockRun.mockResolvedValue(yoloOutput([]));
    await detectFood(image);
    const input = mockRun.mock.calls[0][0].images;
    expect(input.type).toBe('float32');
    expect(input.dims).toEqual([1, 3, 640, 640]);
    const area = 640 * 640;
    // 2:1 image → letterboxed with grey (114) bars on top and bottom
    const topLeft = 0;
    expect(input.data[topLeft]).toBeCloseTo(114 / 255, 2);
    const centre = 320 * 640 + 320;
    expect(input.data[centre]).toBeGreaterThan(0.9); // red channel
    expect(input.data[2 * area + centre]).toBeLessThan(0.1); // blue channel
});

test('drops low-confidence boxes, applies per-class NMS, sorts by confidence', async () => {
    mockRun.mockResolvedValue(yoloOutput([
        { box: [100, 100, 50, 50], scores: { [IDLI]: 0.9 } },
        { box: [102, 101, 50, 50], scores: { [IDLI]: 0.8 } }, // overlaps the first Idli → suppressed
        { box: [100, 100, 50, 50], scores: { [PIZZA]: 0.7 } }, // same box, different class → kept
        { box: [400, 400, 60, 60], scores: { [IDLI]: 0.6 } }, // separate Idli → kept
        { box: [300, 300, 60, 60], scores: { 0: 0.25 } }, // at threshold (strictly greater required) → dropped
        { box: [500, 100, 40, 40], scores: { 0: 0.1, [PIZZA]: 0.2 } }, // below threshold → dropped
    ]));
    await expect(detectFood(image)).resolves.toEqual([
        { food: 'Idli', confidence: 0.9 },
        { food: 'Pizza', confidence: 0.7 },
        { food: 'Idli', confidence: 0.6 },
    ]);
});

test('uses the best-scoring class for each box', async () => {
    mockRun.mockResolvedValue(yoloOutput([{ box: [100, 100, 50, 50], scores: { [IDLI]: 0.4, [PIZZA]: 0.85 } }]));
    await expect(detectFood(image)).resolves.toEqual([{ food: 'Pizza', confidence: 0.85 }]);
});

test('returns an empty list when nothing is detected', async () => {
    mockRun.mockResolvedValue(yoloOutput([]));
    await expect(detectFood(image)).resolves.toEqual([]);
});

test('loads the model only once across calls', async () => {
    mockRun.mockResolvedValue(yoloOutput([]));
    await detectFood(image);
    await detectFood(image);
    expect(mockCreate).toHaveBeenCalledTimes(1);
});

test('rejects input that is not an image', async () => {
    await expect(detectFood(Buffer.from('not an image'))).rejects.toThrow();
});
