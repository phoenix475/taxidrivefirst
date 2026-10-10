import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { listReservations, updateReservationStatus } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type Reservation = {
  id: string;
  created_at: string;
  trip_type: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_at: string;
  vehicle_class: string;
  full_name: string;
  email: string;
  phone: string;
  estimated_price_cents: number | null;
  payment_method: "cash" | "online";
  stripe_payment_status: "unpaid" | "paid" | "refunded";
  status: "pending" | "confirmed" | "completed" | "cancelled";
};

const STATUS_VARIANT: Record<
  Reservation["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
};

function AdminDashboard() {
  const navigate = useNavigate();
  const fetchReservations = useServerFn(listReservations);
  const updateStatus = useServerFn(updateReservationStatus);

  const [ready, setReady] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const data = await fetchReservations();
      setReservations(data as Reservation[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/admin/login" });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (ready) reload();
  }, [ready]);

  const onStatusChange = async (id: string, status: Reservation["status"]) => {
    setError(null);
    try {
      await updateStatus({ data: { id, status } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour.");
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Réservations</h1>
          <Button variant="outline" onClick={onLogout}>
            Déconnexion
          </Button>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reçu le</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Prise en charge</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.email} · {r.phone}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm">{r.pickup_address}</div>
                    <div className="text-xs text-muted-foreground">→ {r.dropoff_address}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.pickup_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell>{r.vehicle_class}</TableCell>
                  <TableCell>
                    {r.estimated_price_cents != null
                      ? `${(r.estimated_price_cents / 100).toFixed(0)} €`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.payment_method === "cash" ? (
                      <Badge variant="outline">Espèces</Badge>
                    ) : (
                      <Badge variant={r.stripe_payment_status === "paid" ? "default" : "secondary"}>
                        {r.stripe_payment_status === "paid"
                          ? "Payé en ligne"
                          : "En attente de paiement"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(value) =>
                        onStatusChange(r.id, value as Reservation["status"])
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">pending</SelectItem>
                        <SelectItem value="confirmed">confirmed</SelectItem>
                        <SelectItem value="completed">completed</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {reservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Aucune réservation pour le moment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
