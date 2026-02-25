"use client";
import { useState } from "react";
import { signInAction } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ background: "#080c0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 380, width: "100%", background: "#0e1419", border: "1px solid #1f2d38", borderRadius: 20, padding: 40 }}>
        <h1 style={{ color: "white", textAlign: "center" }}>Ads<span style={{ color: "#00C8E0" }}>Dash</span></h1>
        <form
          action={async (formData) => {
            setLoading(true);
            setError(null);
            const res = await signInAction(formData);
            if (res?.ok === false) {
              setError(res.message);
              setLoading(false);
            } else {
              window.location.href = "/dashboard";
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input name="email" placeholder="Email" type="email" required style={{ padding: 10, borderRadius: 8, border: "1px solid #1f2d38", background: "#080c0f", color: "white" }} />
          <input name="password" placeholder="Password" type="password" required style={{ padding: 10, borderRadius: 8, border: "1px solid #1f2d38", background: "#080c0f", color: "white" }} />
          <button type="submit" disabled={loading} style={{ padding: 12, background: "#00C8E0", color: "#080c0f", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>
        {error && <p style={{ color: "#ff4d6a" }}>{error}</p>}
      </div>
    </div>
  );
}
