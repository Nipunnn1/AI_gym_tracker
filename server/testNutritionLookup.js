const {
    getNutrition,
    getAvailableFoods
} = require("./services/nutritionLookup");

const foods = getAvailableFoods();

console.log("Nutrition database loaded successfully!");

console.log("Total food records:", foods.length);

console.log("\nFirst 10 food names:");

console.log(foods.slice(0, 10));

if (foods.length > 0) {
    console.log("\nTesting the first food:");

    console.log(getNutrition(foods[0]));
}

console.log("\nTesting an unavailable food:");

console.log(getNutrition("FoodThatDoesNotExist"));