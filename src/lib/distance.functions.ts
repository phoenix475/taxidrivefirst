import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { enforceRateLimit } from "@/lib/rate-limit.server";

const pointSchema = z.object({
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

const tripInputSchema = z.object({ origin: pointSchema, destination: pointSchema });

// Calcule la distance et la durée routières pour afficher le prix estimé.
export const calculateTrip = createServerFn({ method: "POST" })
  .validator((data: unknown) => tripInputSchema.parse(data))
  .handler(async ({ data }) => {
    enforceRateLimit("calculateTrip", 60, 5 * 60 * 1000);

    const { getRouteDistance } = await import("@/lib/route-distance.server");
    return getRouteDistance(data.origin, data.destination);
  });
