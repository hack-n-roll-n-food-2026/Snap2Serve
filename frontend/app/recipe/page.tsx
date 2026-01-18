"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Recipe = {
  title: string;
  short_steps?: string;
  instructions?: string | string[];
  ingredients?: string[];
  missing_items?: string[];
  unknown_ingredients?: string[];
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
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("snap2serve:selected_recipe");
    const shoppingListStored = sessionStorage.getItem("snap2serve:shopping_list_full");
    if (stored) {
      try {
        const parsedRecipe = JSON.parse(stored);
        setRecipe(parsedRecipe);
        // Auto-show modal if there are unknown ingredients
        if (parsedRecipe.unknown_ingredients && parsedRecipe.unknown_ingredients.length > 0) {
          setShowUnknownModal(true);
        }
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
  const formatInstructions = (instructions: string | string[] | undefined): React.ReactNode => {
    if (!instructions) return "";
    
    let steps: string[] = [];
    
    if (typeof instructions === "string") {
      // Split by "Step N:" pattern or numbered patterns like "1.", "2."
      steps = instructions
        .split(/(?=Step \d+:|^\d+\.)/i)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else if (Array.isArray(instructions)) {
      steps = instructions;
    }
    
    // If we found multiple steps, render them as a list
    if (steps.length > 1) {
      return (
        <ol style={{ margin: 0, paddingLeft: 24, lineHeight: 1.8 }}>
          {steps.map((step, idx) => (
            <li key={idx} style={{ marginBottom: 12 }}>
              {step.replace(/^Step \d+:\s*/i, '').replace(/^\d+\.\s*/, '')}
            </li>
          ))}
        </ol>
      );
    }
    
    // Otherwise just display as text
    return instructions;
  };

  const handleSaveToPDF = async () => {
    if (!contentRef.current || !recipe) return;
    
    setIsGeneratingPDF(true);
    
    try {
      // Create a clone of the content for PDF generation
      const element = contentRef.current;
      
      // Capture the content as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0b0f14',
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save the PDF
      const fileName = `${recipe.title.replace(/[^a-z0-9]/gi, '_')}_recipe.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
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

      <div style={S.container} ref={contentRef}>
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

        {/* Save to PDF Button */}
        <div style={S.pdfButtonContainer}>
          <button 
            onClick={handleSaveToPDF} 
            disabled={isGeneratingPDF}
            style={{
              ...S.pdfButton,
              ...(isGeneratingPDF ? S.pdfButtonDisabled : {})
            }}
          >
            {isGeneratingPDF ? (
              <>
                <span style={S.spinner}>⏳</span>
                Generating PDF...
              </>
            ) : (
              <>
                <span style={S.pdfIcon}>📄</span>
                Save Recipe as PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Unknown Ingredients Modal */}
      {showUnknownModal && recipe.unknown_ingredients && recipe.unknown_ingredients.length > 0 && (
        <>
          <div style={S.modalOverlay} onClick={() => setShowUnknownModal(false)} />
          <div style={S.modalCard}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>⚠️ Missing Nutrition Data</div>
              <button 
                style={S.closeBtn}
                onClick={() => setShowUnknownModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={S.modalBody}>
              <p style={S.modalText}>
                The following ingredients were not found in the nutrition database. 
                Their nutritional values are marked as unknown:
              </p>
              <div style={S.tableWrapper}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.tableHeader}>Ingredient</th>
                      <th style={{...S.tableHeader, textAlign: "center"}}>Calories</th>
                      <th style={{...S.tableHeader, textAlign: "center"}}>Protein (g)</th>
                      <th style={{...S.tableHeader, textAlign: "center"}}>Carbs (g)</th>
                      <th style={{...S.tableHeader, textAlign: "center"}}>Fats (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.unknown_ingredients.map((ingredient, idx) => (
                      <tr key={idx} style={idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd}>
                        <td style={S.tableCell}>{ingredient}</td>
                        <td style={{...S.tableCell, textAlign: "center", color: "#94a3b8"}}>??</td>
                        <td style={{...S.tableCell, textAlign: "center", color: "#94a3b8"}}>??</td>
                        <td style={{...S.tableCell, textAlign: "center", color: "#94a3b8"}}>??</td>
                        <td style={{...S.tableCell, textAlign: "center", color: "#94a3b8"}}>??</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
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

  // Modal styles
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 998,
    backdropFilter: "blur(4px)",
  },
  modalCard: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(255,255,255,.96)",
    borderRadius: 20,
    padding: 0,
    maxWidth: 700,
    width: "90%",
    maxHeight: "80vh",
    overflow: "hidden",
    boxShadow: "0 40px 120px rgba(0,0,0,.5)",
    zIndex: 999,
    border: "1px solid rgba(255,255,255,.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid rgba(0,0,0,.08)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },
  closeBtn: {
    background: "rgba(0,0,0,.05)",
    border: "1px solid rgba(0,0,0,.1)",
    borderRadius: 8,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
    color: "#64748b",
    fontWeight: 700,
    transition: "all 0.2s",
  },
  modalBody: {
    padding: "20px 24px",
    maxHeight: "calc(80vh - 80px)",
    overflowY: "auto",
  },
  modalText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
    lineHeight: 1.6,
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  tableHeader: {
    background: "rgba(215,178,106,.15)",
    padding: "12px 16px",
    textAlign: "left",
    fontWeight: 950,
    color: "#0f172a",
    borderBottom: "2px solid rgba(215,178,106,.3)",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRowEven: {
    background: "rgba(0,0,0,.02)",
  },
  tableRowOdd: {
    background: "transparent",
  },
  tableCell: {
    padding: "12px 16px",
    color: "#0f172a",
    borderBottom: "1px solid rgba(0,0,0,.06)",
  },

  // PDF Button styles
  pdfButtonContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: 40,
    paddingBottom: 20,
  },
  pdfButton: {
    background: "linear-gradient(135deg, #d7b26a 0%, #c9a055 100%)",
    color: "#0f172a",
    border: "none",
    borderRadius: 16,
    padding: "16px 32px",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 8px 24px rgba(215, 178, 106, 0.3)",
    transition: "all 0.3s ease",
    letterSpacing: 0.3,
  },
  pdfButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
  },
  pdfIcon: {
    fontSize: 20,
  },
  spinner: {
    fontSize: 20,
    animation: "spin 1s linear infinite",
  },
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
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }
}
