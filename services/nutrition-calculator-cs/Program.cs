using System.Text.Json;
using NutritionService;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { ok = true }));

// Load nutrition db at startup
var dbPath = Path.Combine(AppContext.BaseDirectory, "nutrition_db.json");
var dbJson = File.ReadAllText(dbPath);

var nutritionDb = JsonSerializer.Deserialize<Dictionary<string, NutritionPer100g>>(
    dbJson,
    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
) ?? new();

static string Canon(string s)
    => s.Trim().ToLowerInvariant();

static double? ToGrams(double? amount, string? unit, string ingredientName)
{
    if (amount is null) return null;
    if (string.IsNullOrWhiteSpace(unit)) return null;

    var u = unit.Trim().ToLowerInvariant();

    // weight units
    if (u is "g" or "gram" or "grams") return amount.Value;
    if (u is "kg" or "kilogram" or "kilograms") return amount.Value * 1000.0;

    // volume units (very rough: assume water-like density unless it's oil/milk)
    if (u is "ml" or "milliliter" or "milliliters") return amount.Value; // ~1g/ml
    if (u is "l" or "liter" or "liters") return amount.Value * 1000.0;

    // common kitchen units (rough approximations)
    if (u is "tbsp" or "tablespoon" or "tablespoons") return amount.Value * 15.0;
    if (u is "tsp" or "teaspoon" or "teaspoons") return amount.Value * 5.0;
    if (u is "cup" or "cups") return amount.Value * 240.0;

    // countable items (very rough defaults)
    if (u is "piece" or "pieces" or "pc" or "pcs")
    {
        var name = Canon(ingredientName);
        if (name.Contains("egg")) return amount.Value * 50.0;      // 1 egg ~ 50g edible
        if (name.Contains("tomato")) return amount.Value * 120.0;  // medium tomato
        return amount.Value * 100.0; // generic fallback
    }

    return null;
}

app.MapPost("/nutrition/estimate", (NutritionEstimateRequest req) =>
{
    var unknown = new List<string>();
    var notes = new List<string>();

    double totalCal = 0, totalP = 0, totalC = 0, totalF = 0;

    foreach (var ing in req.Ingredients ?? new())
    {
        var name = Canon(ing.Name);
        if (string.IsNullOrWhiteSpace(name)) continue;

        if (!nutritionDb.TryGetValue(name, out var per100))
        {
            unknown.Add(ing.Name);
            continue;
        }

        // If no amount provided, assume 100g for demo (or skip)
        var grams = ToGrams(ing.Amount, ing.Unit, name);
        if (grams is null)
        {
            notes.Add($"No usable quantity for '{ing.Name}'. Assuming 100g.");
            grams = 100.0;
        }

        var factor = grams.Value / 100.0;

        totalCal += per100.CaloriesKcal * factor;
        totalP += per100.ProteinG * factor;
        totalC += per100.CarbsG * factor;
        totalF += per100.FatG * factor;
    }

    // Round for nicer UI
    double R(double x) => Math.Round(x, 1);

    var resp = new NutritionEstimateResponse(
        Totals: new MacroTotals(
            CaloriesKcal: R(totalCal),
            ProteinG: R(totalP),
            CarbsG: R(totalC),
            FatG: R(totalF)
        ),
        UnknownIngredients: unknown.Distinct().ToList(),
        Notes: notes
    );

    return Results.Json(resp);
});

app.Run("http://0.0.0.0:8080");
