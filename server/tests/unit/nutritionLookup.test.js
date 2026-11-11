/**
 * UNIT TESTS — services/nutritionLookup
 *
 * Why: the lookup is the second half of the food pipeline. Name normalisation
 * (case, whitespace) and numeric parsing decide whether a detection shows
 * calories or "not found", so each rule is checked on its own.
 */
const { getNutrition, getAvailableFoods } = require('../../services/nutritionLookup');

describe('nutrition dataset', () => {
    test('loads the CSV with a non-trivial number of dishes', () => {
        const foods = getAvailableFoods();
        expect(foods.length).toBeGreaterThan(1000);
        expect(foods.every((f) => typeof f === 'string' && f.length > 0)).toBe(true);
    });

    test('every record parses into finite, non-negative macros', () => {
        const broken = getAvailableFoods()
            .map((name) => getNutrition(name))
            .filter((r) => !r.found || [r.calories, r.protein, r.carbohydrates, r.fats].some((v) => !(v >= 0)));
        expect(broken).toEqual([]);
    });
});

describe('getNutrition', () => {
    test('returns macros for an exact match', () => {
        expect(getNutrition('Idli')).toEqual({
            found: true, food: 'Idli', calories: 137.54, protein: 4.64, carbohydrates: 28.18, fats: 0.33,
        });
    });

    test('is case-insensitive and whitespace-tolerant', () => {
        expect(getNutrition('  iDLi ').found).toBe(true);
        expect(getNutrition('Hot   tea (Garam Chai)').found).toBe(true);
    });

    test('returns a not-found result for unknown foods', () => {
        expect(getNutrition('Unobtainium Pie')).toEqual({
            found: false, food: 'Unobtainium Pie', message: 'No exact nutritional record was found.',
        });
    });

    test.each([[''], ['   '], [null], [undefined]])('rejects empty name %p', (name) => {
        expect(getNutrition(name)).toEqual({ found: false, message: 'Food name was not provided.' });
    });

    test('does not do partial matching (documented behaviour)', () => {
        expect(getNutrition('Idl').found).toBe(false);
    });
});
