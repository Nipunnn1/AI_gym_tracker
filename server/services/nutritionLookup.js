const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_PATH = path.resolve(
    __dirname,
    "../../nutrition/data/Indian_Food_Nutrition_Processed.csv"
);

function normalizeFoodName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function loadNutritionData() {
    if (!fs.existsSync(CSV_PATH)) {
        throw new Error(
            `Nutrition CSV not found at: ${CSV_PATH}`
        );
    }

    const csvContent = fs.readFileSync(CSV_PATH, "utf8");

    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true
    });

    if (records.length === 0) {
        throw new Error("The nutrition CSV contains no records.");
    }

    const requiredColumns = [
        "Dish Name",
        "Calories (kcal)",
        "Protein (g)",
        "Carbohydrates (g)",
        "Fats (g)"
    ];

    const availableColumns = Object.keys(records[0]);

    for (const column of requiredColumns) {
        if (!availableColumns.includes(column)) {
            throw new Error(
                `Required column "${column}" is missing from the CSV.`
            );
        }
    }

    return records;
}

const nutritionData = loadNutritionData();

function getNutrition(foodName) {
    const normalizedName = normalizeFoodName(foodName);

    if (!normalizedName) {
        return {
            found: false,
            message: "Food name was not provided."
        };
    }

    const record = nutritionData.find((item) => {
        return (
            normalizeFoodName(item["Dish Name"]) === normalizedName
        );
    });

    if (!record) {
        return {
            found: false,
            food: foodName,
            message: "No exact nutritional record was found."
        };
    }

    const calories = Number(record["Calories (kcal)"]);
    const protein = Number(record["Protein (g)"]);
    const carbohydrates = Number(record["Carbohydrates (g)"]);
    const fats = Number(record["Fats (g)"]);

    if (
        !Number.isFinite(calories) ||
        !Number.isFinite(protein) ||
        !Number.isFinite(carbohydrates) ||
        !Number.isFinite(fats)
    ) {
        return {
            found: false,
            food: record["Dish Name"],
            message: "The nutrition record contains invalid values."
        };
    }

    return {
        found: true,
        food: record["Dish Name"],
        calories,
        protein,
        carbohydrates,
        fats
    };
}

function getAvailableFoods() {
    return nutritionData.map((item) => item["Dish Name"]);
}

module.exports = {
    getNutrition,
    getAvailableFoods
};