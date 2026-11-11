// Food detection with the YOLO model exported to ONNX (server/ml/food.onnx).
// Runs in plain Node via onnxruntime-web (WebAssembly), so no Python is needed
// locally or on Vercel. Pre/post-processing mirrors Ultralytics' predict():
// letterbox to 640x640 (pad 114), conf 0.25, per-class NMS at IoU 0.7.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const ort = require('onnxruntime-web');

const MODEL_PATH = path.join(__dirname, '..', 'ml', 'food.onnx');
const WASM_DIR = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const WASM_PATH = path.join(WASM_DIR, 'ort-wasm-simd-threaded.wasm');

const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.7;
const MAX_DETECTIONS = 300;

// Class order from the trained model (best.pt -> model.names)
const CLASS_NAMES = [
    'Apple', 'Chapathi', 'Chicken Gravy', 'Fries', 'Idli', 'Pizza',
    'Rice', 'Soda', 'Tomato', 'Vada', 'banana', 'burger'
];

let sessionPromise = null;

function getSession() {
    if (!sessionPromise) {
        // Single-threaded: serverless functions don't benefit from wasm workers
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.wasmBinary = fs.readFileSync(WASM_PATH);
        ort.env.wasm.wasmPaths = pathToFileURL(WASM_DIR).href + '/';

        sessionPromise = ort.InferenceSession
            .create(fs.readFileSync(MODEL_PATH))
            .catch((err) => {
                sessionPromise = null;
                throw err;
            });
    }
    return sessionPromise;
}

async function preprocess(imageBuffer) {
    // Apply EXIF orientation, then letterbox into a 640x640 RGB canvas
    const meta = await sharp(imageBuffer).metadata();
    const { width, height } = meta.autoOrient || meta;
    const image = sharp(imageBuffer).rotate();

    const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);
    const padLeft = Math.round((INPUT_SIZE - newW) / 2 - 0.1);
    const padTop = Math.round((INPUT_SIZE - newH) / 2 - 0.1);

    const { data } = await image
        .removeAlpha()
        .toColourspace('srgb')
        .resize(newW, newH, { fit: 'fill', kernel: 'linear' })
        .extend({
            top: padTop,
            bottom: INPUT_SIZE - newH - padTop,
            left: padLeft,
            right: INPUT_SIZE - newW - padLeft,
            background: { r: 114, g: 114, b: 114 }
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

    // HWC uint8 -> CHW float32 in [0, 1]
    const area = INPUT_SIZE * INPUT_SIZE;
    const tensorData = new Float32Array(3 * area);
    for (let i = 0; i < area; i++) {
        tensorData[i] = data[i * 3] / 255;
        tensorData[area + i] = data[i * 3 + 1] / 255;
        tensorData[2 * area + i] = data[i * 3 + 2] / 255;
    }

    return new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function iou(a, b) {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    return inter / (areaA + areaB - inter + 1e-9);
}

function postprocess(output) {
    // output dims: [1, 4 + numClasses, numAnchors]
    const [, channels, anchors] = output.dims;
    const numClasses = channels - 4;
    const d = output.data;

    const candidates = [];
    for (let a = 0; a < anchors; a++) {
        let best = 0;
        let classId = -1;
        for (let c = 0; c < numClasses; c++) {
            const score = d[(4 + c) * anchors + a];
            if (score > best) {
                best = score;
                classId = c;
            }
        }
        if (best <= CONF_THRESHOLD) continue;

        const cx = d[a];
        const cy = d[anchors + a];
        const w = d[2 * anchors + a];
        const h = d[3 * anchors + a];
        candidates.push({
            classId,
            confidence: best,
            x1: cx - w / 2,
            y1: cy - h / 2,
            x2: cx + w / 2,
            y2: cy + h / 2
        });
    }

    candidates.sort((p, q) => q.confidence - p.confidence);

    const kept = [];
    for (const cand of candidates) {
        if (kept.length >= MAX_DETECTIONS) break;
        const overlaps = kept.some(
            (k) => k.classId === cand.classId && iou(k, cand) > IOU_THRESHOLD
        );
        if (!overlaps) kept.push(cand);
    }

    return kept.map((k) => ({
        food: CLASS_NAMES[k.classId] || `class_${k.classId}`,
        confidence: Math.round(k.confidence * 10000) / 10000
    }));
}

async function detectFood(imageBuffer) {
    const session = await getSession();
    const input = await preprocess(imageBuffer);
    const results = await session.run({ [session.inputNames[0]]: input });
    return postprocess(results[session.outputNames[0]]);
}

module.exports = {
    detectFood,
    MODEL_PATH,
    CLASS_NAMES
};
