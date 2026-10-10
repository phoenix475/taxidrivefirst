import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { bootstrapAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/setup")({
  component: AdminSetup,
});

function AdminSetup() {
  const navigate = useNavigate();
  const submit = useServerFn(bootstrapAdmin);
  const [setupCode, setSetupCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await submit({ data: { setupCode, email, password } });
      navigate({ to: "/admin/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-bold">Créer le compte administrateur</h1>
        <p className="text-sm text-muted-foreground">
          Cette page ne fonctionne qu'une seule fois, avant la création du premier administrateur.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="setupCode">Code de configuration</Label>
          <Input
            id="setupCode"
            required
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Création…" : "Créer le compte"}
        </Button>
      </form>
    </div>
  );
}
