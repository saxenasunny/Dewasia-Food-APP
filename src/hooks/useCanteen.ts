import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Canteen } from "../types";

/** The single canteen used in Version 1; the schema keeps canteen_id everywhere. */
export const PRIMARY_CANTEEN_ID = "11111111-1111-4111-8111-111111111111";

interface UseCanteenResult {
  canteen: Canteen | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCanteen(): UseCanteenResult {
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase!;
    let cancelled = false;

    const load = async () => {
      const { data, error: err } = await client
        .from("canteens")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (err) setError(err.message);
      setCanteen((data as Canteen | null) ?? null);
      setLoading(false);
    };

    void load();

    const channel = client
      .channel("canteen-state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "canteens" },
        (payload) => {
          if (!cancelled) setCanteen(payload.new as Canteen);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [nonce]);

  return { canteen, loading, error, reload };
}
