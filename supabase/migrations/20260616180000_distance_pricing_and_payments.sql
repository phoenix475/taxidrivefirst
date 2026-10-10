
-- Distance/durée calculées (Google Distance Matrix) et heures pour la mise à disposition
ALTER TABLE public.reservations
  ADD COLUMN distance_km NUMERIC,
  ADD COLUMN duration_minutes INT,
  ADD COLUMN hours INT;

-- Mode de paiement choisi par le client, et statut du paiement en ligne (Stripe)
CREATE TYPE public.payment_method AS ENUM ('cash', 'online');
CREATE TYPE public.stripe_payment_status AS ENUM ('unpaid', 'paid', 'refunded');

ALTER TABLE public.reservations
  ADD COLUMN payment_method public.payment_method NOT NULL DEFAULT 'cash',
  ADD COLUMN stripe_session_id TEXT,
  ADD COLUMN stripe_payment_status public.stripe_payment_status NOT NULL DEFAULT 'unpaid';
