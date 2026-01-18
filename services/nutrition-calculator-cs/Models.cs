namespace NutritionService;

public record IngredientInput(
    string Name,
    double? Amount,
    string? Unit
);

public record NutritionEstimateRequest(
    List<IngredientInput> Ingredients
);

public record MacroTotals(
    double CaloriesKcal,
    double ProteinG,
    double CarbsG,
    double FatG
);

public record NutritionEstimateResponse(
    MacroTotals Totals,
    List<string> UnknownIngredients,
    List<string> Notes
);

public record NutritionPer100g(
    double CaloriesKcal,
    double ProteinG,
    double CarbsG,
    double FatG
);
