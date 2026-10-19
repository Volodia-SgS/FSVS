import { useState } from "react";
import { supabase } from "../supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const run = async (mode: "signin" | "signup") => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      const text =
        error.message === "Invalid login credentials"
          ? "E-mail ou mot de passe incorrect."
          : error.message.includes("Signups not allowed")
            ? "La création de compte est désactivée."
            : error.message;
      setMessage({ kind: "error", text });
    } else if (mode === "signup" && !data.session) {
      setMessage({ kind: "info", text: "Compte créé : confirme ton adresse via l'e-mail reçu, puis connecte-toi." });
    }
  };

  return (
    <div className="login">
      <form
        className="card login-card"
        onSubmit={(e) => {
          e.preventDefault();
          run("signin");
        }}
      >
        <h1>Nutrition</h1>
        <p className="muted small">Connecte-toi pour retrouver tes données sur tous tes appareils.</p>
        <label className="field">
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className={message.kind === "error" ? "login-error" : "muted small"}>{message.text}</p>}
        <button className="primary" type="submit" disabled={busy}>
          Se connecter
        </button>
        <button type="button" className="link" disabled={busy || !email || password.length < 6} onClick={() => run("signup")}>
          Première fois ? Créer mon compte
        </button>
      </form>
    </div>
  );
}
