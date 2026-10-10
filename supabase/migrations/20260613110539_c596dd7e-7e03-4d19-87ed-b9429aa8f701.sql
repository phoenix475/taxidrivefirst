
-- Restrict has_role execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Tighten reservation insert policy with field validation
DROP POLICY "Anyone can submit a reservation request" ON public.reservations;

CREATE POLICY "Anyone can submit a reservation request"
ON public.reservations FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(full_name)        BETWEEN 2 AND 100
  AND char_length(email)        BETWEEN 5 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(phone)        BETWEEN 6 AND 30
  AND char_length(pickup_address)  BETWEEN 3 AND 300
  AND char_length(dropoff_address) BETWEEN 3 AND 300
  AND (notes IS NULL OR char_length(notes) <= 1000)
  AND (flight_number IS NULL OR char_length(flight_number) <= 20)
  AND pickup_at > now() - interval '1 hour'
  AND pickup_at < now() + interval '2 years'
);
