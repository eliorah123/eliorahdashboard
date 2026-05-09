"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  toAuthUser,
  translateAuthError,
  isAllowedPath,
  ROLE_HOME,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthCtx {
  user:    AuthUser | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<{ error?: string }>;
  signUp:  (name: string, email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user:    null,
  loading: true,
  signIn:  async () => ({}),
  signUp:  async () => ({}),
  signOut: async () => {},
});

const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password"]);

// ─── Fetch profile (DB source of truth) ────────────────────────────────────────
// Uses up to 3 retries within a 4-second budget.

async function fetchProfile(
  userId: string,
): Promise<{ name: string; role: UserRole } | null> {
  const deadline = Date.now() + 4000;

  for (let i = 0; i < 3; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 100) break;

    try {
      const result = await Promise.race([
        // Wrap in real Promise so .race works correctly
        (async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", userId)
            .single();
          return { data, error };
        })(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
      ]);

      if (result === null) break;                              // timed out
      if (result.data && !result.error) return result.data as { name: string; role: UserRole };
      if (result.error?.code === "PGRST116") return null;     // no row — stop retrying
    } catch {
      // network error — retry
    }

    if (i < 2) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }

  return null;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router     = useRouter();
  const pathname   = usePathname();
  const isAuthPage = AUTH_PAGES.has(pathname);

  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [loading,      setLoading]      = useState(true);
  // Route protection waits for this before running, so stale user_metadata
  // role never triggers a wrong redirect.
  const [profileReady, setProfileReady] = useState(false);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setProfileReady(true);
      return;
    }

    let cancelled = false;

    // Emergency abort — guarantees blank screen never lasts > 7s
    const emergencyTimer = setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setProfileReady(true);
      if (!isAuthPage) router.replace("/login");
    }, 7000);

    async function init() {
      try {
        // ── Resolve session ──────────────────────────────────────────────────
        // getSession() can hang while refreshing an expired token over the
        // network. Race it against a 5-second timeout so we never block forever.
        const session = await Promise.race([
          supabase.auth.getSession().then(({ data }) => data.session),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);

        if (cancelled) return;

        if (!session) {
          clearTimeout(emergencyTimer);
          setUser(null);
          setLoading(false);
          setProfileReady(true);
          if (!isAuthPage) router.replace("/login");
          return;
        }

        // ── Phase 1: end blank screen immediately with metadata role ─────────
        // Route protection is gated on profileReady so the stale role in
        // user_metadata never triggers a wrong redirect.
        setUser(toAuthUser(session.user));
        setLoading(false);

        // ── Phase 2: fetch authoritative role from DB ────────────────────────
        const profile = await fetchProfile(session.user.id);
        clearTimeout(emergencyTimer);

        if (cancelled) return;

        const realUser = profile
          ? toAuthUser(session.user, profile)
          : toAuthUser(session.user);

        setUser(realUser);
        setProfileReady(true);

        if (isAuthPage) router.replace(realUser.role === "vendedor" ? "/sales" : "/");
      } catch {
        clearTimeout(emergencyTimer);
        if (cancelled) return;
        setLoading(false);
        setProfileReady(true);
        if (!isAuthPage) router.replace("/login");
      }
    }

    init();

    // Handle subsequent auth events (sign-out, cross-tab sign-in, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "INITIAL_SESSION") return; // handled by init()

        if (!session?.user || event === "SIGNED_OUT") {
          if (!cancelled) {
            setUser(null);
            setProfileReady(true);
            router.replace("/login");
          }
          return;
        }

        if (event === "SIGNED_IN") {
          const profile = await fetchProfile(session.user.id);
          if (cancelled) return;
          const u = profile
            ? toAuthUser(session.user, profile)
            : toAuthUser(session.user);
          setUser(u);
          setProfileReady(true);
          if (isAuthPage) router.replace(u.role === "vendedor" ? "/sales" : "/");
        }
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(emergencyTimer);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Route protection ──────────────────────────────────────────────────────
  // Only runs after Phase 2 completes so the DB role drives the decision.

  useEffect(() => {
    if (loading || !user || isAuthPage || !profileReady) return;
    if (!isAllowedPath(user.role, pathname)) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [pathname, user?.role, loading, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auth actions ───────────────────────────────────────────────────────────

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };

    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      const u = profile ? toAuthUser(data.user, profile) : toAuthUser(data.user);
      setUser(u);
      setProfileReady(true);
    }
    router.replace("/");
    return {};
  }

  async function signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<{ error?: string }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: "vendedor" as UserRole } },
    });
    if (error) return { error: translateAuthError(error.message) };
    if (!data.session) return { error: "Verifique seu e-mail para ativar o acesso." };
    router.replace("/");
    return {};
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setUser(null);
    setProfileReady(true);
    router.replace("/login");
  }

  const blocking = loading && !isAuthPage;

  // ─── Setup screen ──────────────────────────────────────────────────────────

  if (!isSupabaseConfigured && !isAuthPage) {
    return (
      <div className="min-h-screen bg-[#f3f6f3] flex items-center justify-center px-5">
        <div
          className="bg-white rounded-2xl border border-gray-100 px-8 py-7 max-w-[420px] w-full"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.05)" }}
        >
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #1a3228 0%, #2d5a3d 100%)" }}
          >
            <span className="text-white font-bold text-[14px]">E</span>
          </div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Configuração necessária</h2>
          <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
            Edite{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono text-[12px]">
              .env.local
            </code>{" "}
            com as credenciais do Supabase.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-[11.5px] text-gray-600 space-y-1">
            <p><span className="text-green-700">NEXT_PUBLIC_SUPABASE_URL</span>=https://xxx.supabase.co</p>
            <p><span className="text-green-700">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>=eyJ...</p>
            <p><span className="text-green-700">SUPABASE_SERVICE_ROLE_KEY</span>=eyJ...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {blocking ? <div className="min-h-screen bg-[#f3f6f3]" /> : children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthCtx {
  return useContext(AuthContext);
}
