"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>Snap2Serve</h1>
        <h2 style={styles.subtitle}>{isSignUp ? "Sign Up" : "Sign In"}</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleAuth} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          style={styles.toggle}
        >
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #0b0f14 0%, #111827 100%)",
  } as React.CSSProperties,
  box: {
    background: "rgba(255,255,255,.94)",
    borderRadius: 24,
    padding: 32,
    maxWidth: 400,
    width: "100%",
    color: "#0f172a",
  } as React.CSSProperties,
  title: {
    fontSize: 28,
    fontWeight: 950,
    marginBottom: 4,
    margin: "0 0 4px 0",
  } as React.CSSProperties,
  subtitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 20,
    opacity: 0.7,
    margin: "0 0 20px 0",
  } as React.CSSProperties,
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } as React.CSSProperties,
  input: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,.12)",
    fontSize: 14,
    fontFamily: "inherit",
  } as React.CSSProperties,
  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#D7B26A",
    color: "#111",
    fontWeight: 950,
    cursor: "pointer",
    marginTop: 8,
  } as React.CSSProperties,
  toggle: {
    background: "none",
    border: "none",
    color: "#D7B26A",
    cursor: "pointer",
    fontSize: 13,
    marginTop: 16,
    textDecoration: "underline",
  } as React.CSSProperties,
  error: {
    background: "rgba(255,80,80,.08)",
    border: "1px solid rgba(255,100,100,.35)",
    color: "rgba(255,80,80,.95)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
  } as React.CSSProperties,
};
