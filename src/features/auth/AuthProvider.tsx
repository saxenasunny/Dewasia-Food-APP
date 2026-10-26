import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { Profile, UserRole } from "../../types";

interface AuthContextValue {
  configured: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  isGuest: boolean;
  isOperator: boolean;
  continueAsGuest: () => Promise<void>;
  signInOperator: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, role, college_identifier, created_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [loadProfile, session?.user.id]);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (!cancelled) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next?.user.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const continueAsGuest = useCallback(async () => {
    if (!supabase) throw new Error("Supabase is not configured.");
    // Already in a session (guest or otherwise) - keep it.
    if (session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  }, [session]);

  const signInOperator = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(
      error.message === "Invalid login credentials"
        ? "Email or password is incorrect."
        : error.message,
    );
    const { data: row } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const role = row?.role as UserRole | undefined;
    if (role !== "operator" && role !== "admin") {
      await supabase.auth.signOut();
      throw new Error("This account is not a canteen operator.");
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Keep the local cart: sign-out should not destroy a half-built order.
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = (profile?.role ?? null) as UserRole | null;
    const user = session?.user ?? null;
    return {
      configured: isSupabaseConfigured,
      session,
      user,
      profile,
      role,
      loading,
      isGuest: Boolean(user?.is_anonymous),
      isOperator: role === "operator" || role === "admin",
      continueAsGuest,
      signInOperator,
      signOut,
      refreshProfile,
    };
  }, [session, profile, loading, continueAsGuest, signInOperator, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
