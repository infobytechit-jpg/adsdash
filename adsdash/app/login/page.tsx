"use client";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    setMsg("JS is working!");
  }, []);

  return (
    <div style={{ background: "black", color: "white", minHeight: "100vh", padding: 40 }}>
      <h1>{msg}</h1>
      <p>URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "ENV VAR MISSING"}</p>
    </div>
  );
}
