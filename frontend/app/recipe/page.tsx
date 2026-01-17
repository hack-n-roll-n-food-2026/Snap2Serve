"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Recipe = {
  title: string;
  short_steps?: string;
  instructions?: string | string[];
  ingredients?: string[];
  missing_items?: string[];
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
};

export default function RecipePage() {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [shoppingList, setShoppingList] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("snap2serve:selected_recipe");
    const shoppingListStored = sessionStorage.getItem("snap2serve:shopping_list_full");
    if (stored) {
      try {
        setRecipe(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recipe:", e);
      }
    }
    if (shoppingListStored) {
      try {
        setShoppingList(JSON.parse(shoppingListStored));
      } catch (e) {
        console.error("Failed to parse shopping list:", e);
      }
    }
  }, []);

  // Helper to format instructions (handle both string and array)
  const formatInstructions = (instructions: string | string[] | undefined): string => {
    if (!instructions) return "";
    if (typeof instructions === "string") return instructions;
    if (Array.isArray(instructions)) return instructions.join("\n");
    return "";
  };

  if (!recipe) {
    return (
      <div style={S.page}>
        <div style={S.topbar}>
          <Link href="/results" style={S.backBtn}>← Back</Link>
          <div style={S.brand}>Snap2Serve</div>
          <div style={{ width: 80 }} />
        </div>
        <div style={S.container}>
          <div style={S.muted}>Loading recipe...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <Link href="/results" style={S.backBtn}>← Back</Link>
        <div style={S.brand}>Snap2Serve</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={S.container}>
        <div style={S.header}>
          <div>
            <div style={S.title}>{recipe.title}</div>
            <div style={S.sub}>
              Complete recipe with full instructions and ingredients
            </div>
          </div>
        </div>

        {/* Ingredients Section */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Ingredients</div>
            <div style={S.card}>
              <ul style={S.ingredientsList}>
                {recipe.ingredients.map((ingredient, idx) => (
                  <li key={idx} style={S.ingredientItem}>{ingredient}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Nutrition Section */}
        {recipe.nutrition && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Nutritional Information</div>
            <div style={S.card}>
              <div style={S.nutritionGrid}>
                <div style={S.nutritionItem}>
                  <div style={S.nutritionValue}>{recipe.nutrition.calories}</div>
                  <div style={S.nutritionLabel}>Calories</div>
                </div>
                <div style={S.nutritionItem}>
                  <div style={S.nutritionValue}>{recipe.nutrition.protein}g</div>
                  <div style={S.nutritionLabel}>Protein</div>
                </div>
                <div style={S.nutritionItem}>
                  <div style={S.nutritionValue}>{recipe.nutrition.carbs}g</div>
                  <div style={S.nutritionLabel}>Carbs</div>
                </div>
                <div style={S.nutritionItem}>
                  <div style={S.nutritionValue}>{recipe.nutrition.fats}g</div>
                  <div style={S.nutritionLabel}>Fats</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Missing Items */}
        {shoppingList && Object.keys(shoppingList).length > 0 ? (
          <div style={S.section}>
            <div style={S.sectionTitle}>Items to Buy</div>
            <div style={S.card}>
              <div style={S.shoppingList}>
                {Object.entries(shoppingList).map(([category, items]) => (
                  <div key={category} style={S.shoppingCategory}>
                    <div style={S.categoryTitle}>{category}</div>
                    <ul style={S.categoryItems}>
                      {items.map((item, idx) => (
                        <li key={idx} style={S.categoryItem}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : recipe.missing_items && recipe.missing_items.length > 0 ? (
          <div style={S.section}>
            <div style={S.sectionTitle}>Items to Buy</div>
            <div style={S.card}>
              <ul style={S.ingredientsList}>
                {recipe.missing_items.map((item, idx) => (
                  <li key={idx} style={S.ingredientItemMissing}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {/* Instructions Section */}
        {recipe.instructions && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Instructions</div>
            <div style={S.card}>
              <div style={S.instructionsText}>{formatInstructions(recipe.instructions)}</div>
            </div>
          </div>
        )}

        {/* Short Steps as fallback */}
        {!recipe.instructions && recipe.short_steps && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Steps</div>
            <div style={S.card}>
              <div style={S.instructionsText}>{recipe.short_steps}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== styles ===== */
const S: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b0f14 0%, #0b0f14 40%, #111827 100%)",
    color: "#fff",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    position: "sticky",
    top: 0,
    background: "rgba(11,15,20,.75)",
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  brand: { fontWeight: 950, letterSpacing: 0.2 },
  backBtn: {
    color: "rgba(255,255,255,.85)",
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
  },
  container: { maxWidth: 900, margin: "0 auto", padding: "22px 18px 56px" },
  header: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end", marginBottom: 28 },
  title: { fontSize: 34, fontWeight: 950, letterSpacing: -0.3 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 14, maxWidth: 680 },
  
  section: { marginBottom: 28 },
  sectionTitle: { fontWeight: 950, fontSize: 18, marginBottom: 14 },
  
  card: {
    background: "rgba(255,255,255,.94)",
    color: "#0f172a",
    borderRadius: 22,
    padding: 20,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
  },
  
  ingredientsList: {
    margin: 0,
    paddingLeft: 20,
    listStyle: "none",
  },
  ingredientItem: {
    fontSize: 15,
    lineHeight: 1.8,
    color: "#0f172a",
    position: "relative",
    paddingLeft: 16,
  },
  ingredientItemMissing: {
    fontSize: 15,
    lineHeight: 1.8,
    color: "#0f172a",
    opacity: 0.7,
    position: "relative",
    paddingLeft: 16,
  },
  
  shoppingList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 10 },
  shoppingCategory: { 
    background: "linear-gradient(135deg, rgba(215,178,106,.08) 0%, rgba(215,178,106,.04) 100%)",
    borderRadius: 14, 
    padding: "16px 14px", 
    border: "1px solid rgba(215,178,106,.25)",
  },
  categoryTitle: { fontWeight: 950, fontSize: 13, marginBottom: 10, color: "#0f172a", letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.8 },
  categoryItems: { margin: 0, paddingLeft: 20, listStyle: "none" },
  categoryItem: { fontSize: 14, lineHeight: 1.6, color: "#0f172a", marginBottom: 6, position: "relative" },
  
  instructionsText: {
    fontSize: 15,
    lineHeight: 1.8,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
  },

  nutritionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 20,
    textAlign: "center",
  },
  nutritionItem: {
    padding: 16,
    background: "rgba(215,178,106,.08)",
    borderRadius: 12,
    border: "1px solid rgba(215,178,106,.25)",
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 14,
    color: "#0f172a",
    opacity: 0.8,
    fontWeight: 600,
  },

  muted: { opacity: 0.7 },
};

// add bullet point styling for ingredient lists
if (typeof document !== "undefined") {
  const id = "snap2serve-recipe-style";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `
      li[style*="position: relative"] {
        list-style: disc;
      }
      li[style*="position: relative"]::before {
        content: '';
      }
    `;
    document.head.appendChild(s);
  }
}
