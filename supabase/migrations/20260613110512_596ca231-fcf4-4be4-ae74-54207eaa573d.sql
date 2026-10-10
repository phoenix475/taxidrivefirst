
-- Roles enum + table (best practice: roles in their own table)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Reservations table
CREATE TYPE public.trip_type AS ENUM ('one_way', 'round_trip', 'hourly');
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_type public.trip_type NOT NULL DEFAULT 'one_way',
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ,
  passengers INT NOT NULL DEFAULT 1 CHECK (passengers BETWEEN 1 AND 8),
  luggage INT NOT NULL DEFAULT 0 CHECK (luggage BETWEEN 0 AND 10),
  vehicle_class TEXT NOT NULL DEFAULT 'business',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  flight_number TEXT,
  notes TEXT,
  estimated_price_cents INT,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.reservations TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a reservation request"
ON public.reservations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read reservations"
ON public.reservations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reservations"
ON public.reservations FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reservations"
ON public.reservations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
