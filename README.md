# 🏋️ AI Gym Tracker – Real-Time Exercise Tracking & Nutrition Assistant

An AI-powered fitness application that combines real-time exercise tracking with food detection and nutritional information lookup. The project aims to help users monitor their workouts and make more informed nutritional decisions through computer vision and machine learning.

## 🚀 Overview

The AI Gym Tracker integrates exercise tracking and nutrition assistance into a single application.

The exercise tracking component uses computer vision to monitor workout movements and track exercise repetitions. The nutrition component uses a YOLO object detection model to identify food items from images and retrieves corresponding nutritional information from a structured food dataset.

By combining these features, the application provides a unified platform for workout monitoring and food analysis.

## ✨ Features

### 💪 1. Real-Time Exercise Tracking
- Tracks workout movements using computer vision.
- Supports exercise monitoring and repetition counting.
- Provides visual feedback through the dashboard.
- Helps users monitor their workout sessions.

### 🍎 2. AI-Based Food Detection
- Uses a trained YOLO object detection model to identify food items in images.
- Generates predicted food labels and confidence scores.
- Processes food images through the nutrition detection backend.
- Returns detected food items for nutritional analysis.

### 🥗 3. Nutritional Information Lookup
- Uses a structured food nutrition dataset.
- Matches detected food names against available dataset entries.
- Retrieves nutritional information for matching food items.
- Provides available calorie, protein, carbohydrate, and fat values.
- Indicates when nutritional information cannot be found for a detected food.

### 🖥️ 4. Integrated Dashboard
- Combines exercise tracking and nutrition assistance in one interface.
- Displays food detection results.
- Presents available nutritional information.
- Provides a centralized interface for fitness-related activities.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Computer vision and food detection |
| YOLO | Food object detection |
| OpenCV | Image processing and computer vision |
| JavaScript / TypeScript | Application and frontend logic |
| React / Next.js | Dashboard interface |
| Node.js | Backend runtime |
| Express.js | Backend API routing |
| CSV | Structured nutritional information storage |
| Git and GitHub | Version control and project hosting |

*Note: The exact libraries and versions depend on the project's installed dependencies.*

## 🧠 System Architecture

The application follows a modular architecture in which the frontend communicates with the backend, and the backend coordinates food detection and nutrition lookup.

```text
                   ┌─────────────────────────┐
                   │       User              │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   Frontend Dashboard    │
                   │   React / Next.js       │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │      Node.js Server     │
                   │      Express API        │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   Food Detection API    │
                   │   Python + YOLO         │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │    Detected Food Items  │
                   │  Labels + Confidence    │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   Nutrition Lookup      │
                   │   CSV Dataset           │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │  Nutritional Results    │
                   │ Calories, Protein,      │
                   │ Carbohydrates and Fats  │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   Dashboard Results     │
                   └─────────────────────────┘
```

The exercise tracking component operates as part of the broader fitness application.

## 📂 Project Structure

The following is the expected structure of the main files relevant to the project. Your complete repository may contain additional files.

```text
AI_gym_tracker/
│
├── nutrition/
│   ├── best.pt
│   ├── yolo.py
│   ├── test_food.jpg
│   └── data/
│       └── Indian_Food_Nutrition_Processed.csv
│
├── server/
│   ├── routes/
│   │   └── nutrition.js
│   ├── services/
│   │   └── nutritionLookup.js
│   ├── testNutritionLookup.js
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── src/
│   └── components/
│       └── Dashboard.tsx
│
├── .gitignore
└── README.md
```

### Important Files

| File | Description |
|---|---|
| `nutrition/best.pt` | Trained YOLO model weights used for food detection |
| `nutrition/yolo.py` | Python script that performs food detection |
| `nutrition/data/Indian_Food_Nutrition_Processed.csv` | Dataset containing food names and nutritional values |
| `server/routes/nutrition.js` | Backend route for nutrition-related requests |
| `server/services/nutritionLookup.js` | Service for retrieving nutritional information |
| `server/testNutritionLookup.js` | Script for testing nutrition lookup |
| `server/server.js` | Backend server entry point |
| `src/components/Dashboard.tsx` | Dashboard component |

## ⚙️ Installation and Setup

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Python
- Git
- Visual Studio Code or another code editor

The Python environment must also have the dependencies required by the YOLO model and computer vision scripts.

### 1. Clone the Repository

```bash
git clone https://github.com/Nipunnn1/AI_gym_tracker.git
```

Navigate to the project directory:

```bash
cd AI_gym_tracker
```

### 2. Install Backend Dependencies

Navigate to the server directory:

```bash
cd server
```

Install the Node.js dependencies:

```bash
npm install
```

Return to the project root:

```bash
cd ..
```

### 3. Set Up the Python Environment

Create a virtual environment from the project root:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

If you use Command Prompt instead of PowerShell:

```cmd
venv\Scripts\activate.bat
```

Install the Python dependencies required by the project:

```bash
pip install ultralytics opencv-python
```

Install any other dependencies required by your existing exercise tracking and nutrition scripts.

### 4. Configure Environment Variables

If the application requires API keys or environment variables, configure them according to your local setup.

Do not commit passwords, API keys, tokens, or other secrets to GitHub.

### 5. Start the Backend

From the `server` directory, run:

```bash
node server.js
```

The backend should start if the required dependencies and configuration are present.

Use the port configured in your `server.js` file.

### 6. Start the Frontend

Open a separate terminal in the project directory containing the frontend `package.json`.

Install the frontend dependencies if necessary:

```bash
npm install
```

Start the development server using the script defined in that package's `package.json`. For a standard Next.js development setup, this is commonly:

```bash
npm run dev
```

Open the local address printed in the terminal.

**Important:** If your repository uses separate frontend and backend directories, run the frontend and backend commands from their respective directories.

## 🍽️ Nutrition Detection Workflow

The nutrition component follows these steps:

1. The user provides a food image through the application.
2. The backend sends the image to the Python detection script.
3. The YOLO model predicts the food items present in the image.
4. The detection script returns food labels and confidence scores.
5. The backend looks up each detected food name in the nutrition dataset.
6. Matching records provide the available calorie and macronutrient values.
7. The backend returns the enriched detection results to the frontend.
8. The dashboard displays the detected food and its available nutritional information.

### Nutritional Values

The lookup service supports the following fields:

| Nutrient | Description |
|---|---|
| Calories | Energy value in kilocalories |
| Protein | Protein content in grams |
| Carbohydrates | Carbohydrate content in grams |
| Fats | Fat content in grams |

The unit basis of the dataset should be checked before interpreting these values as per-serving or per-100-gram quantities.

**Important limitation:** Food detection identifies visual categories, not exact food weight or portion size. Nutritional estimates depend on the dataset match and the accuracy of the food identification.

## 🧪 Testing

### Test the Nutrition Lookup Service

Navigate to the backend directory:

```bash
cd server
```

Run:

```bash
node testNutritionLookup.js
```

This tests the nutrition lookup functionality using the configured dataset.

### Test Food Detection

Use the included food image or another supported image to test the detection script.

From the project root, run:

```bash
python nutrition/yolo.py
```

The script may require an image path or other arguments, depending on its current implementation. Supply the input as expected by the script.

Check that the output contains the predicted food labels and confidence scores.

### Test the Integrated Application

Verify the following:

- The frontend loads successfully.
- The backend starts without errors.
- Food images can be submitted for detection.
- The detection script returns results.
- Matching food names retrieve nutritional information.
- Unknown food names are handled gracefully.
- The dashboard displays the returned results.
- Exercise tracking continues to work as expected.

## 🔬 Machine Learning Approach

The nutrition component uses a YOLO object detection model.

The model produces predicted food categories and confidence scores for input images. The backend then uses the predicted food names to query the nutritional dataset.

The nutrition lookup does not itself predict nutrients using machine learning. It retrieves existing values from the dataset.

The exercise tracking component uses computer vision to support workout monitoring.

## ⚠️ Limitations

- Food detection performance depends on the trained model and input image quality.
- Visually similar foods may be misclassified.
- Nutrition values are only available when a suitable dataset entry is found.
- Exact calories consumed cannot be determined reliably from an image without appropriate portion-size estimation.
- Nutritional values depend on the accuracy and measurement basis of the source dataset.
- Exercise tracking performance depends on camera placement, visibility, and movement detection.
- Model performance metrics should be measured using an appropriately labelled test dataset.

## 🔮 Future Enhancements

Potential improvements include:

- Expanding the food dataset with additional cuisines and food categories.
- Improving food-name matching between YOLO predictions and dataset entries.
- Adding portion-size estimation.
- Supporting meal history and daily nutrition summaries.
- Adding user profiles and personalized fitness goals.
- Improving exercise tracking across a wider range of workouts.
- Evaluating the food detection model with precision, recall, F1-score, and mAP.
- Measuring inference time and exercise repetition-counting error.
- Adding workout and nutrition history visualizations.

These are potential enhancements and are not necessarily implemented in the current version.

## 🔒 Privacy and Security

- Keep API keys and credentials outside the public repository.
- Exclude virtual environments, generated build files, and unnecessary dependencies from version control.
- Review uploaded images and datasets before publishing.
- Check model and dataset licensing before redistributing them.

## 👨‍💻 Author

**Nipun Kamineni**

GitHub: [@Nipunnn1](https://github.com/Nipunnn1)

Project Repository: [AI_gym_tracker](https://github.com/Nipunnn1/AI_gym_tracker)

## 📄 License

A license has not been specified here. Add a `LICENSE` file before presenting the project as open source, and ensure that the selected license is compatible with the licenses of the model and dataset.

---

⭐ If you find this project interesting, consider starring the repository!