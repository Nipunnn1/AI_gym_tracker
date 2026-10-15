import sys
import json
import os
from ultralytics import YOLO

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Image path not provided"
        }))
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.isfile(image_path):
        print(json.dumps({
            "success": False,
            "error": f"Image does not exist: {image_path}"
        }))
        sys.exit(1)

    model_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "best.pt"
    )

    model = YOLO(model_path)
    results = model.predict(source=image_path, conf=0.25, verbose=False)

    detections = []

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())

            detections.append({
                "food": model.names[class_id],
                "confidence": round(confidence, 4)
            })

    print(json.dumps({
        "success": True,
        "detections": detections
    }))

if __name__ == "__main__":
    main()