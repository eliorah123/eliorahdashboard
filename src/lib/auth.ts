import type { User } from "@supabase/supabase-js";

// ─── Domain types ──────────────────────────────────────────────────────────────

export type UserRole = "admin" | "gestor" | "vendedor";

export interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role:  UserRole;
}

// ─── Supabase → domain mapper ──────────────────────────────────────────────────
// profile overrides user_metadata so that DB-level role changes take effect
// without requiring a token refresh.

export function toAuthUser(
  user:     User,
  profile?: { name?: string | null; role?: UserRole | null },
): AuthUser {
  return {
    id:    user.id,
    email: user.email ?? "",
    name:
      profile?.name ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Usuário",
    role:
      profile?.role ??
      (user.user_metadata?.role as UserRole | undefined) ??
      "vendedor",
  };
}

// ─── Route permissions ─────────────────────────────────────────────────────────

export const ROLE_HOME: Record<UserRole, string> = {
  admin:    "/",
  gestor:   "/",
  vendedor: "/sales",
};

export function isAllowedPath(role: UserRole, path: string): boolean {
  if (role === "admin")  return true;
  if (role === "gestor") return !path.startsWith("/settings");
  // vendedor: only /sales subtree
  return path === "/sales" || path.startsWith("/sales/");
}

// ─── Error translation ─────────────────────────────────────────────────────────

const ERROR_MAP: Record<string, string> = {
  "Invalid login credentials":                "E-mail ou senha incorretos.",
  "Email not confirmed":                      "Confirme seu e-mail antes de entrar.",
  "User already registered":                  "Este e-mail já está em uso.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Email rate limit exceeded":                "Muitas tentativas. Aguarde alguns minutos.",
  "signup_disabled":                          "Cadastro desativado. Contate o administrador.",
  "over_email_send_rate_limit":               "Muitas tentativas. Aguarde alguns minutos.",
};

export function translateAuthError(message: string): string {
  return ERROR_MAP[message] ?? message;
}
