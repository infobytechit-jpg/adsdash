"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div style={{ background: "#080c0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 380, width: "100%", background: "#0e1419", border: "1px solid #1f2d38", borderRadius: 20, padding: 40 }}>
        <h1 style={{ color: "white", textAlign: "center" }}>Ads<span style={{ color: "#00C8E0" }}>Dash</span></h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required style={{ padding: 10, borderRadius: 8, border: "1px solid #1f2d38", background: "#080c0f", color: "white" }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" required style={{ padding: 10, borderRadius: 8, border: "1px solid #1f2d38", background: "#080c0f", color: "white" }} />
          <button type="submit" disabled={loading} style={{ padding: 12, background: "#00C8E0", color: "#080c0f", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
        </form>
        {error && <p style={{ color: "#ff4d6a", marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
