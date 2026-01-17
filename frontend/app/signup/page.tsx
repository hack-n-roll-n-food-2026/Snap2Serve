"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserAuth = {
  email: string;
};

const AUTH_KEY = "snap2serve:auth"; // stores { email }
const USERS_KEY = "snap2serve:users"; // stores { [email]: { password } }

function loadUsers(): Record<string, { password: string }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, { password: string }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setAuthedUser(email: string) {
  const payload: UserAuth = { email };
  localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.trim().length >= 4;
  }, [email, password]);

  function onSubmit() {
    setError(null);
    setOk(null);

    const e = email.trim().toLowerCase();
    const p = password;

    const users = loadUsers();
    const exists = !!users[e];

    if (mode === "signup") {
      if (exists) {
        setError("Account already exists. Switch to Login.");
        return;
      }
      users[e] = { password: p };
      saveUsers(users);
      setAuthedUser(e);
      setOk("Signed up ✅ Redirecting...");
      setTimeout(() => router.push("/signup"), 400);
      return;
    }

    // login
    if (!exists) {
      setError("No account found. Switch to Sign up.");
      return;
    }
    if (users[e].password !== p) {
      setError("Wrong password.");
      return;
    }
    setAuthedUser(e);
    setOk("Logged in ✅ Redirecting...");
    setTimeout(() => router.push("/profile"), 400);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Welcome to Snap2Serve</h1>
          <p style={styles.heroSub}>Turn your ingredients into delicious recipes with AI</p>
        </div>
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
            <div style={styles.logo}>🍽️</div>
            <h2 style={{ margin: 0, marginLeft: 10, color: "white" }}>Snap2Serve</h2>
          </div>

          <div style={styles.toggleRow}>
            <button
              onClick={() => setMode("login")}
              style={{ ...styles.toggleBtn, ...(mode === "login" ? styles.toggleActive : {}) }}
            >
              Login
            </button>
            <button
              onClick={() => setMode("signup")}
              style={{ ...styles.toggleBtn, ...(mode === "signup" ? styles.toggleActive : {}) }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>📧 Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                style={styles.input}
                autoComplete="email"
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>🔒 Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 4 chars"
                style={styles.input}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {ok && <div style={styles.ok}>{ok}</div>}

            <button disabled={!canSubmit} type="submit" style={{ ...styles.primary, opacity: canSubmit ? 1 : 0.5 }}>
              {mode === "login" ? "Login" : "Create account"}
            </button>
          </form>

          <button onClick={() => router.push("/")} style={styles.ghost}>
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "'Inter', sans-serif",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: 1200,
    width: "100%",
  },
  hero: {
    textAlign: "center",
    marginBottom: 40,
    color: "white",
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: 700,
    margin: 0,
    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
  },
  heroSub: {
    fontSize: 18,
    margin: "10px 0 0",
    opacity: 0.9,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "rgba(0,0,0,0.8)",
    borderRadius: 20,
    padding: 30,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  logo: {
    fontSize: 40,
  },
  toggleRow: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.3s ease",
  },
  toggleActive: {
    background: "rgba(255,255,255,0.2)",
    color: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "rgba(255,255,255,0.9)",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    color: "white",
    outline: "none",
    fontSize: 16,
    transition: "border-color 0.3s ease",
    boxSizing: "border-box",
    "::placeholder": {
      color: "rgba(255,255,255,0.5)",
    },
  },
  primary: {
    width: "100%",
    marginTop: 20,
    padding: "14px 16px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    background: "linear-gradient(135deg, #ff6b6b, #ffa500)",
    color: "white",
    transition: "transform 0.2s ease",
  },
  ghost: {
    width: "100%",
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 14,
    transition: "background-color 0.3s ease",
  },
  error: {
    marginTop: 10,
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(239,68,68,0.2)",
    border: "1px solid rgba(239,68,68,0.5)",
    color: "#fca5a5",
    fontSize: 14,
  },
  ok: {
    marginTop: 10,
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(34,197,94,0.2)",
    border: "1px solid rgba(34,197,94,0.5)",
    color: "#86efac",
    fontSize: 14,
  },
};
