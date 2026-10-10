-- Schéma de la base Postgres (Render). Idempotent : peut être rejoué sans risque.
--   psql "$DATABASE_URL" -f db/schema.sql

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'online');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stripe_payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_type TEXT NOT NULL DEFAULT 'one_way',
  pickup_address TEXT NOT NULL CHECK (char_length(pickup_address) BETWEEN 3 AND 300),
  dropoff_address TEXT NOT NULL CHECK (char_length(dropoff_address) BETWEEN 3 AND 300),
  pickup_at TIMESTAMPTZ NOT NULL,
  passengers INT NOT NULL DEFAULT 1 CHECK (passengers BETWEEN 1 AND 8),
  luggage INT NOT NULL DEFAULT 0 CHECK (luggage BETWEEN 0 AND 10),
  vehicle_class TEXT NOT NULL DEFAULT 'van',
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  -- Le téléphone est le seul moyen de contact : le chauffeur appelle ou envoie
  -- un SMS au client.
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  distance_km NUMERIC,
  duration_minutes INT,
  estimated_price_cents INT,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  stripe_session_id TEXT,
  stripe_payment_status stripe_payment_status NOT NULL DEFAULT 'unpaid',
  status reservation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_created_at_idx ON reservations (created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_stripe_session_idx ON reservations (stripe_session_id);
