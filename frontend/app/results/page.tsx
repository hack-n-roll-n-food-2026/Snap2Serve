"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGestureGate } from "../context/GestureGateContext";

type Ingredient = { name: string; confidence?: number };

type Recipe = {
  title: string;
  short_steps?: string;
  instructions?: string;
  ingredients?: string[];
  missing_items?: string[];
};

const BACKEND = "https://snap2serve-backend-452474271642.asia-southeast1.run.app";

export default function ResultsPage() {
  const router = useRouter();
  const { protectAction, isGateActive } = useGestureGate();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [shoppingList, setShoppingList] = useState<Record<string, string[]> | null>(null);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ingredientDetected, setIngredientDetected] = useState(false);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [newIngredient, setNewIngredient] = useState("");
  const [editingPrompt, setEditingPrompt] = useState(false);

  // read from sessionStorage (set by page 1)
  useEffect(() => {
    const img = sessionStorage.getItem("snap2serve:image");
    const p = sessionStorage.getItem("snap2serve:prompt") || "";
    const savedIngredients = sessionStorage.getItem("snap2serve:ingredients");
    const savedRecipes = sessionStorage.getItem("snap2serve:recipes");
    const savedShoppingList = sessionStorage.getItem("snap2serve:shopping_list");
    const savedIngredientDetected = sessionStorage.getItem("snap2serve:ingredient_detected");
    
    setImageDataUrl(img);
    setPrompt(p);
    
    if (savedIngredients) setIngredients(JSON.parse(savedIngredients));
    if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
    if (savedShoppingList) setShoppingList(JSON.parse(savedShoppingList));
    if (savedIngredientDetected === "true") setIngredientDetected(true);
  }, []);

  const topIngredients = useMemo(
    () => ingredients.map((x) => x.name).filter(Boolean),
    [ingredients]
  );

  function addIngredient(name: string) {
    if (name.trim() && !ingredients.some(ing => ing.name.toLowerCase() === name.trim().toLowerCase())) {
      setIngredients([...ingredients, { name: name.trim() }]);
    }
    setNewIngredient("");
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  async function detectIngredients() {
    if (!imageDataUrl) {
      setError("No uploaded image found. Go back and upload a photo first.");
      return;
    }

    // Protect this action with the gesture gate
    try {
      await protectAction(async () => {
        setLoading(true);
        setError(null);
        setStage("Uploading image…");

        const blob = await (await fetch(imageDataUrl)).blob();
        const file = new File([blob], "ingredients.jpg", { type: blob.type || "image/jpeg" });
        const form = new FormData();
        form.append("image", file);

        setStage("Detecting ingredients…");
        const ingRes = await fetch(`${BACKEND}/upload/image`, {
          method: "POST",
          body: form,
        });

        if (!ingRes.ok) throw new Error(await ingRes.text());
        const ingJson = await ingRes.json();
        const ingList: Ingredient[] = ingJson.ingredients_detected ?? [];
        setIngredients(ingList);
        setIngredientDetected(true);
        sessionStorage.setItem("snap2serve:ingredients", JSON.stringify(ingList));
        sessionStorage.setItem("snap2serve:ingredient_detected", "true");
        setStage("");
      });
    } catch (e: any) {
      if (e?.message === "Gesture gate cancelled") {
        // User cancelled the gesture gate, don't show error
        return;
      }
      setError(e?.message || "Something went wrong.");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  async function recommendRecipes() {
    // Protect this action with the gesture gate
    try {
      await protectAction(async () => {
        setLoading(true);
        setError(null);
        setStage("Finding best recipes…");

        const recipeRes = await fetch(`${BACKEND}/agent/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredients_confirmed: topIngredients,
            preference_text: prompt,
          }),
        });

        if (!recipeRes.ok) throw new Error(await recipeRes.text());
        const recipeJson = await recipeRes.json();
        const recipesList = recipeJson.recipes ?? [];
        const shoppingListData = recipeJson.shopping_list ?? null;
        setRecipes(recipesList);
        setShoppingList(shoppingListData);
        sessionStorage.setItem("snap2serve:recipes", JSON.stringify(recipesList));
        sessionStorage.setItem("snap2serve:shopping_list", JSON.stringify(shoppingListData));
        setStage("");
      });
    } catch (e: any) {
      if (e?.message === "Gesture gate cancelled") {
        // User cancelled the gesture gate, don't show error
        return;
      }
      setError(e?.message || "Something went wrong.");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  // auto-run ingredient detection once when we have image
  useEffect(() => {
    if (imageDataUrl && !ingredientDetected) detectIngredients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  function handlePromptDone() {
    setEditingPrompt(false);
    sessionStorage.setItem("snap2serve:prompt", prompt.trim());
    // Re-run recipe recommendation with updated prompt
    if (ingredientDetected && topIngredients.length > 0) {
      recommendRecipes();
    }
  }

  function handleBack() {
    // Clear all snap2serve data from sessionStorage
    sessionStorage.removeItem("snap2serve:image");
    sessionStorage.removeItem("snap2serve:prompt");
    sessionStorage.removeItem("snap2serve:ingredients");
    sessionStorage.removeItem("snap2serve:recipes");
    sessionStorage.removeItem("snap2serve:shopping_list");
    sessionStorage.removeItem("snap2serve:ingredient_detected");
    router.push("/");
  }

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <button onClick={handleBack} style={S.backBtn}>← Back</button>
        <div style={S.brand}>Snap2Serve</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={S.container}>
        <div style={S.header}>
          <div>
            <div style={S.title}>{!ingredientDetected ? "Detecting ingredients" : recipes.length > 0 ? "Your recipe matches" : "Confirm your ingredients"}</div>
            <div style={S.sub}>
              {!ingredientDetected ? "Please wait..." : recipes.length > 0 ? "We detected ingredients from your photo and ranked recipes that best match your request." : "Please review and confirm your ingredients to get recipe recommendations."}
            </div>
          </div>

          {ingredientDetected && recipes.length === 0 && (
            <button onClick={() => detectIngredients()} disabled={loading} style={S.primaryBtn(loading)}>
              {loading ? "Working…" : "Re-detect"}
            </button>
          )}
        </div>

        {/* Summary row */}
        <div style={S.grid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Upload</div>
            {imageDataUrl ? (
              <img src={imageDataUrl} alt="upload" style={S.preview} />
            ) : (
              <div style={S.muted}>No image found.</div>
            )}
            <div style={{ height: 10 }} />
            <div style={S.label}>What you want to cook</div>
            {!editingPrompt ? (
              <div style={S.promptBox} onClick={() => setEditingPrompt(true)} title="Click to edit">
                {prompt || <span style={S.muted}>Click to add preference</span>}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePromptDone()}
                  placeholder="e.g., Korean spicy chicken, Japanese ramen..."
                  style={S.promptInput}
                  autoFocus
                />
                <button onClick={() => handlePromptDone()} style={S.promptDoneBtn}>Done</button>
              </div>
            )}
            {editingPrompt && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>Press Enter or click Done to save</div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>
              Detected ingredients
              {ingredientDetected && recipes.length === 0 && (
                !editingIngredients ? (
                  <button onClick={() => setEditingIngredients(true)} style={S.editBtn}>Edit</button>
                ) : (
                  <button onClick={() => setEditingIngredients(false)} style={S.doneBtn}>Done</button>
                )
              )}
            </div>
            {topIngredients.length === 0 ? (
              <div style={S.muted}>None yet.</div>
            ) : (
              <div style={S.chips}>
                {ingredients.map((ing, i) => (
                  <span key={i} style={S.chip}>
                    {ing.name}
                    {editingIngredients && (
                      <button onClick={() => removeIngredient(i)} style={S.removeBtn} title="Remove ingredient">×</button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {editingIngredients && (
              <div style={S.addIngredient}>
                <input type="text" value={newIngredient} onChange={(e) => setNewIngredient(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addIngredient(newIngredient)} placeholder="Add ingredient..." style={S.addInput} />
                <button onClick={() => addIngredient(newIngredient)} disabled={!newIngredient.trim()} style={S.addBtn(!newIngredient.trim())}>Add</button>
              </div>
            )}
            {ingredientDetected && recipes.length === 0 && !editingIngredients && (
              <button onClick={() => recommendRecipes()} disabled={loading || topIngredients.length === 0} style={S.confirmBtn(loading || topIngredients.length === 0)}>{loading ? "Finding recipes…" : "Confirm & Get Recipes →"}</button>
            )}
          </div>
        </div>

        {/* Status + error */}
        {loading && (
          <div style={S.status}>
            <span style={S.spinner} />
            <span>{stage || "Loading…"}</span>
          </div>
        )}

        {error && (
          <div style={S.errorBox}>
            <b>Backend error:</b> {error}
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Check that your backend is running at <code>{BACKEND}</code>.
            </div>
          </div>
        )}

        {/* Recipes */}
        <div style={{ height: 14 }} />
        <div style={S.sectionTitle}>Top recipes</div>

        {recipes.length === 0 && !loading && !error ? (
          <div style={S.muted}>No recipes found yet.</div>
        ) : (
          <div style={S.recipeGrid}>
            {recipes.map((r, idx) => (
              <div
                key={idx}
                style={S.recipeCard}
                onClick={() => {
                  sessionStorage.setItem("snap2serve:selected_recipe", JSON.stringify(r));
                  sessionStorage.setItem("snap2serve:shopping_list_full", JSON.stringify(shoppingList));
                  router.push("/recipe");
                }}
              >
                <div style={S.recipeTop}>
                  <div style={S.recipeName}>{r.title}</div>
                </div>

                {r.short_steps ? <div style={S.recipeSummary}>{r.short_steps}</div> : null}

                {Array.isArray(r.missing_items) && r.missing_items.length > 0 ? (
                  <div style={S.smallRow}>
                    <span style={S.smallLabel}>Missing:</span>{" "}
                    <span style={S.smallText}>{r.missing_items.join(", ")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* No shopping list section */}
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
  container: { maxWidth: 1100, margin: "0 auto", padding: "22px 18px 56px" },
  header: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end" },
  title: { fontSize: 34, fontWeight: 950, letterSpacing: -0.3 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 14, maxWidth: 680 },
  primaryBtn: (disabled: boolean) => ({
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(215,178,106,.5)",
    background: disabled ? "rgba(255,255,255,.08)" : "#D7B26A",
    color: disabled ? "rgba(255,255,255,.6)" : "#111",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
  }),

  grid: { display: "grid", gridTemplateColumns: "1.1fr 1.2fr", gap: 14, marginTop: 18 },
  card: {
    background: "rgba(255,255,255,.94)",
    color: "#0f172a",
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
  },
  cardTitle: { fontWeight: 950, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" },
  preview: { width: "100%", height: 220, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(15,23,42,.10)" },
  label: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  promptBox: {
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,.10)",
    background: "rgba(15,23,42,.03)",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  promptInput: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(215,178,106,.4)",
    background: "rgba(255,255,255,.98)",
    fontWeight: 800,
    fontSize: 14,
    outline: "none",
  },
  promptDoneBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #D7B26A",
    background: "#D7B26A",
    color: "#111",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
  },

  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,.12)",
    background: "rgba(15,23,42,.03)",
    fontWeight: 850,
    fontSize: 12,
  },
  chipPct: { opacity: 0.55, fontWeight: 800 },

  status: {
    marginTop: 14,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.85)",
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,.35)",
    borderTopColor: "rgba(255,255,255,1)",
    animation: "spin 0.8s linear infinite",
  },

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,100,100,.35)",
    background: "rgba(255,80,80,.08)",
    color: "rgba(255,220,220,.95)",
  },

  sectionTitle: { marginTop: 10, fontWeight: 950, fontSize: 16 },
  recipeGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 12 },

  recipeCard: {
    display: "block",
    textDecoration: "none",
    color: "#0f172a",
    background: "rgba(255,255,255,.94)",
    borderRadius: 22,
    padding: 14,
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
    transition: "transform .12s ease, box-shadow .12s ease",
    cursor: "pointer",
  }
, recipeCardHover: {
    transform: "translateY(-4px)",
    boxShadow: "0 40px 100px rgba(0,0,0,.45)",
  },
  recipeTop: { marginBottom: 8 },
  recipeName: { fontWeight: 950, fontSize: 16, lineHeight: 1.2 },
  recipeMeta: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  recipeSummary: { marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.4 },
  smallRow: { marginTop: 10, fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap" },
  smallLabel: { opacity: 0.6, fontWeight: 900 },
  smallText: { opacity: 0.9 },
  openLink: { marginTop: 12, fontSize: 12, fontWeight: 950, color: "#111827", opacity: 0.85 },

  shoppingList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 12 },
  shoppingCategory: { background: "rgba(255,255,255,.94)", borderRadius: 16, padding: 14, border: "1px solid rgba(255,255,255,.12)" },
  categoryTitle: { fontWeight: 950, fontSize: 14, marginBottom: 8, color: "#000" },
  categoryItems: { margin: 0, paddingLeft: 16 },
  categoryItem: { fontSize: 13, lineHeight: 1.4, color: "#000" },

  editBtn: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(15,23,42,.2)", background: "rgba(15,23,42,.05)", cursor: "pointer" },
  doneBtn: { fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #D7B26A", background: "#D7B26A", color: "#111", cursor: "pointer" },
  removeBtn: { marginLeft: 6, fontSize: 14, color: "#ff4444", cursor: "pointer", border: "none", background: "none", padding: 0 },
  addIngredient: { marginTop: 12, display: "flex", gap: 8 },
  addInput: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,.2)", fontSize: 14 },
  addBtn: (disabled: boolean) => ({
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(215,178,106,.5)",
    background: disabled ? "rgba(255,255,255,.08)" : "#D7B26A",
    color: disabled ? "rgba(255,255,255,.6)" : "#111",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  confirmBtn: (disabled: boolean) => ({
    marginTop: 32,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(215,178,106,.5)",
    background: disabled ? "rgba(255,255,255,.08)" : "#D7B26A",
    color: disabled ? "rgba(255,255,255,.6)" : "#111",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
  }),

  muted: { opacity: 0.7 },
};

// add global keyframes (quick hack)
if (typeof document !== "undefined") {
  const id = "snap2serve-spin-style";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.innerHTML = `@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`;
    document.head.appendChild(s);
  }
}
