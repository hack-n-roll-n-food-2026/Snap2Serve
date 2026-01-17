"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Page() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  const canContinue = useMemo(() => !!file && prompt.trim().length > 0, [file, prompt]);

  // Redirect to signup if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/signup");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/signup");
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0b0f14 0%, #111827 100%)", color: "#fff" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function handleContinue() {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      sessionStorage.setItem("snap2serve:image", dataUrl);
      sessionStorage.setItem("snap2serve:prompt", prompt.trim());
      router.push("/results");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={S.page}>
      <header style={S.hero}>
        {/* dark overlay for readability */}
        <div style={S.heroOverlay} />
        {/* NEW: soft vignette (no bar) */}
        <div style={S.heroVignette} />

        <div style={S.heroInner}>
          <div style={S.nav}>
            <div style={S.brand}>Snap2Serve</div>

            <div style={S.searchPill}>
              <span style={{ opacity: 0.75 }}>🔎</span>
              <span style={{ opacity: 0.7 }}>Search recipes, cuisines, ingredients…</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={S.chipGold}>Premium</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.85)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 950,
                }}
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>

          <div style={S.heroText}>
            <div style={S.heroTitle}>Menu</div>
            <div style={S.heroTitle2}>Recipevine</div>
            <div style={S.heroSub}>
              Upload ingredients → tell us what you want to cook → we’ll generate recipes + shopping list.
            </div>
          </div>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.sheet}>
          {/* NEW: blend edge (no sharp seam) */}
          <div style={S.sheetBlendTop} />

          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardTitle}>Step 1: Upload ingredients photo</div>
              <div style={S.smallMuted}>JPG/PNG · 1 image</div>
            </div>

            <label style={S.filePick}>
              <input type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
              <span style={S.fileBtn}>{file ? "Change photo" : "Choose photo"}</span>
              <span style={S.fileName}>{file ? file.name : "No file selected"}</span>
            </label>

            <div style={{ height: 14 }} />

            {previewUrl ? (
              <div style={S.previewBox}>
                <img src={previewUrl} alt="preview" style={S.previewImg} />
              </div>
            ) : (
              <div style={S.previewEmpty}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 34, marginBottom: 6 }}>📷</div>
                  <div style={S.smallMuted}>Upload a photo of ingredients to begin</div>
                </div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardTitle}>Step 2: What do you want to cook?</div>
              <div style={S.smallMuted}>Cuisine / dish</div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g., "Korean spicy chicken", "Japanese ramen", "Healthy salad bowl"'
              style={S.textInput}
              rows={3}
            />

            <div style={S.hint}>
              Tip: Add constraints like “high protein”, “vegetarian”, “15 mins”, “no oven”.
            </div>

            <div style={S.ctaRow}>
              <button onClick={handleContinue} disabled={!canContinue} style={goldBtn(!canContinue)}>
                Continue →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ===== Theme ===== */
const T = {
  text: "#0f172a",
  muted: "rgba(15,23,42,.58)",
  border: "rgba(15,23,42,.10)",
  gold: "#D7B26A",
};

function goldBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 16,
    border: `1px solid ${disabled ? T.border : "rgba(215,178,106,.55)"}`,
    background: disabled ? "rgba(0,0,0,.06)" : T.gold,
    color: disabled ? "rgba(0,0,0,.35)" : "#111",
    fontWeight: 950,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b0f14", color: "#fff" },

  hero: {
    height: 420,
    position: "relative",
    backgroundImage:
      "url('https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1600&q=80')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(0,0,0,.88), rgba(0,0,0,.40) 55%, rgba(0,0,0,.18))",
  },
  // NEW: vignette gives depth + natural fade (no horizontal band)
  heroVignette: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 520px at 30% 30%, rgba(0,0,0,0) 0%, rgba(0,0,0,.35) 55%, rgba(11,15,20,.95) 100%)",
    pointerEvents: "none",
  },

  heroInner: { position: "relative", maxWidth: 1180, margin: "0 auto", padding: "18px 18px 0" },
  nav: { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center" },
  brand: { fontWeight: 950, fontSize: 18 },

  searchPill: {
    height: 44,
    borderRadius: 999,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.30)",
    backdropFilter: "blur(10px)",
    maxWidth: 720,
  },
  chipGold: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(215,178,106,.55)",
    background: "rgba(0,0,0,.30)",
    color: T.gold,
    fontWeight: 900,
    fontSize: 12,
    justifySelf: "end",
  },

  heroText: { marginTop: 70, maxWidth: 640 },
  premiumLabel: { letterSpacing: 2, opacity: 0.75, fontSize: 12, fontWeight: 700 },
  heroTitle: { fontSize: 72, fontWeight: 950, lineHeight: 1, marginTop: 6 },
  heroTitle2: { fontSize: 72, fontWeight: 950, lineHeight: 1, fontStyle: "italic" },
  heroSub: { marginTop: 14, maxWidth: 520, fontSize: 14, opacity: 0.86 },

  main: { padding: "0 18px 56px", background: "#0b0f14" },

  sheet: {
    position: "relative",
    maxWidth: 1020,
    margin: "-30px auto 0",
    padding: 18,
    borderRadius: 28,
    background: "rgba(246,246,247,.94)",
    border: "1px solid rgba(255,255,255,.12)",
    boxShadow: "0 40px 120px rgba(0,0,0,.55)",
    color: T.text,
    display: "grid",
    gap: 14,
    overflow: "hidden",
  },

  // NEW: top blend that looks like the sheet is "melting" into hero
  sheetBlendTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -28,
    height: 70,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.35) 45%, rgba(255,255,255,0) 100%)",
    filter: "blur(12px)",
    pointerEvents: "none",
    opacity: 0.9,
  },

  card: {
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 22,
    padding: 14,
    boxShadow: "0 10px 30px rgba(15,23,42,.06)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 950 },
  smallMuted: { fontSize: 12, color: T.muted },

  filePick: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    border: `1px solid ${T.border}`,
    background: "rgba(0,0,0,.015)",
  },
  fileBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${T.border}`,
    background: "rgba(0,0,0,.03)",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  fileName: { color: T.muted, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" },

  previewBox: {
    borderRadius: 18,
    overflow: "hidden",
    border: `1px solid ${T.border}`,
    boxShadow: "0 18px 50px rgba(0,0,0,.10)",
  },
  previewImg: { width: "100%", height: 300, objectFit: "cover", display: "block" },

  previewEmpty: {
    height: 300,
    borderRadius: 18,
    border: `1px solid ${T.border}`,
    background: "radial-gradient(circle at 50% 40%, rgba(215,178,106,.12), rgba(0,0,0,0) 55%)",
    display: "grid",
    placeItems: "center",
  },

  textInput: {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 16,
    border: `1px solid ${T.border}`,
    outline: "none",
    fontWeight: 750,
    fontSize: 14,
    background: "rgba(255,255,255,.98)",
    minHeight: "60px",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  hint: { marginTop: 10, fontSize: 12, color: T.muted },
  ctaRow: { marginTop: 14, display: "flex", justifyContent: "flex-end" },
};
