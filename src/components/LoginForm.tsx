"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("church.clerk@sda.local");
  const [password, setPassword] = useState("Adventist123!");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    setPending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not sign in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="form-grid single login-form" onSubmit={login}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
          required
        />
      </div>
      {error ? <div className="error-message">{error}</div> : null}
      <button className="button login-submit" disabled={pending} type="submit">
        <LogIn size={16} aria-hidden="true" />
        Sign in
      </button>
    </form>
  );
}
