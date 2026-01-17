"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ProfileData = {
  medicalCondition: string;
  photoURL: string;
  email?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    medicalCondition: "",
    photoURL: "",
    email: "",
    createdAt: undefined,
    lastLoginAt: undefined,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/signup");
      return;
    }

    // Fetch user profile from Firestore
    const fetchProfile = async () => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile({
          email: user.email || "",
          medicalCondition: data.medicalCondition || "",
          photoURL: data.photoURL || "",
          createdAt: data.createdAt?.toDate?.(),
          lastLoginAt: data.lastLoginAt?.toDate?.(),
        });
      } else {
        // If document doesn't exist, set user email
        setProfile((prev) => ({
          ...prev,
          email: user.email || "",
        }));
      }
    };

    fetchProfile();
  }, [user, loading, router]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setMessage("");

    try {
      const userRef = doc(db, "users", user.uid);
      // Use setDoc with merge to create or update the document
      await setDoc(userRef, {
        medicalCondition: profile.medicalCondition,
        photoURL: profile.photoURL,
      }, { merge: true });

      setMessage("Profile updated successfully!");
      setIsEditing(false);

      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Error updating profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div style={S.page}>Loading...</div>;
  }

  if (!user) {
    return <div style={S.page}>Redirecting...</div>;
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>My Profile</h1>

        {message && (
          <div
            style={{
              ...S.message,
              background: message.includes("Error")
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(34, 197, 94, 0.1)",
              color: message.includes("Error") ? "#dc2626" : "#16a34a",
            }}
          >
            {message}
          </div>
        )}

        <div style={S.card}>
          <div style={S.section}>
            <label style={S.label}>Email</label>
            <div style={S.valueRead}>{profile.email}</div>
          </div>

          <div style={S.section}>
            <label style={S.label}>Account Created</label>
            <div style={S.valueRead}>
              {profile.createdAt
                ? profile.createdAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A"}
            </div>
          </div>

          <div style={S.section}>
            <label style={S.label}>Last Login</label>
            <div style={S.valueRead}>
              {profile.lastLoginAt
                ? profile.lastLoginAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A"}
            </div>
          </div>

          <div style={S.section}>
            <label style={S.label}>Medical Condition</label>
            {isEditing ? (
              <input
                type="text"
                value={profile.medicalCondition}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    medicalCondition: e.target.value,
                  })
                }
                placeholder="e.g., diabetes, vegetarian, gluten-free"
                style={S.input}
              />
            ) : (
              <div style={S.value}>
                {profile.medicalCondition || "Not specified"}
              </div>
            )}
          </div>

          <div style={S.section}>
            <label style={S.label}>Photo URL</label>
            {isEditing ? (
              <input
                type="url"
                value={profile.photoURL}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    photoURL: e.target.value,
                  })
                }
                placeholder="https://example.com/photo.jpg"
                style={S.input}
              />
            ) : (
              <div style={S.value}>
                {profile.photoURL ? (
                  <>
                    <div style={S.photoPreview}>
                      <img
                        src={profile.photoURL}
                        alt="Profile"
                        style={S.photo}
                      />
                    </div>
                    <div style={S.urlText}>{profile.photoURL}</div>
                  </>
                ) : (
                  <div style={{ color: "#999" }}>No photo uploaded</div>
                )}
              </div>
            )}
          </div>

          <div style={S.actions}>
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={S.saveBtn}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setMessage("");
                  }}
                  style={S.cancelBtn}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} style={S.editBtn}>
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          style={S.backBtn}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    padding: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 500,
  },
  title: {
    fontSize: 32,
    fontWeight: 950,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  message: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 500,
  },
  card: {
    background: "rgba(246, 246, 247, 0.94)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    color: "#333",
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    color: "#555",
    wordBreak: "break-word",
  },
  valueRead: {
    fontSize: 15,
    color: "#333",
    fontWeight: 500,
    padding: "8px 0",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  photoPreview: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #ddd",
  },
  photo: {
    width: "100%",
    height: 200,
    objectFit: "cover",
    display: "block",
  },
  urlText: {
    fontSize: 12,
    color: "#999",
    wordBreak: "break-all",
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 24,
  },
  editBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#D7B26A",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#22c55e",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#333",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  backBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid rgba(215, 178, 106, 0.55)",
    background: "rgba(0, 0, 0, 0.3)",
    color: "#D7B26A",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    width: "100%",
  },
};
