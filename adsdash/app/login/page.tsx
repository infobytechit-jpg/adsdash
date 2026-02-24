"use client";

import { useState } from "react";
import { signInAction } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", color: "white" }}>
      <h1>Login</h1>

      <form
        action={async (formData) => {
          setError(null);
          const res = await signInAction(formData);
          if (res?.ok === false) setError(res.message);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input name="email" placeholder="Email" />
        <input name="password" placeholder="Password" type="password" />
        <button type="submit">Sign in</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
