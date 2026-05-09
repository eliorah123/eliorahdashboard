"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import type { UserRole } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ManagedUser {
  id:         string;
  name:       string;
  email:      string;
  role:       UserRole;
  active:     boolean;
  lastSignIn: string | null;
  sellerId:   string | null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

async function countAdmins(db: AdminClient): Promise<number> {
  const { count } = await db
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}

async function countActiveAdmins(db: AdminClient): Promise<number> {
  const { data: adminProfiles } = await db
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!adminProfiles?.length) return 0;

  const adminIds = new Set(adminProfiles.map((p) => p.id as string));

  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });

  return users.filter((u) => {
    if (!adminIds.has(u.id)) return false;
    const banned = (u as { banned_until?: string | null }).banned_until;
    return !banned || new Date(banned) < new Date();
  }).length;
}

async function getUserRole(db: AdminClient, userId: string): Promise<UserRole | null> {
  const { data } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role as UserRole) ?? null;
}

// ─── List ───────────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<{ users?: ManagedUser[]; error?: string }> {
  try {
    const db = createAdminClient();

    const [authRes, profilesRes] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("profiles").select("id, name, role, seller_id"),
    ]);

    if (authRes.error)     return { error: authRes.error.message };
    if (profilesRes.error) return { error: profilesRes.error.message };

    const profiles = profilesRes.data ?? [];

    const users: ManagedUser[] = authRes.data.users.map((u) => {
      const profile     = profiles.find((p) => p.id === u.id);
      const bannedUntil = (u as { banned_until?: string | null }).banned_until;
      const active      = !bannedUntil || new Date(bannedUntil) < new Date();

      return {
        id:         u.id,
        name:       profile?.name ?? (u.user_metadata?.name as string | undefined) ?? u.email?.split("@")[0] ?? "Usuário",
        email:      u.email ?? "",
        role:       ((profile?.role ?? "vendedor") as UserRole),
        active,
        lastSignIn: u.last_sign_in_at ?? null,
        sellerId:   (profile?.seller_id as string | null) ?? null,
      };
    });

    users.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return { users };
  } catch (e: unknown) {
    return { error: (e as Error).message };
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────────

export async function createUser(data: {
  name:     string;
  email:    string;
  password: string;
  role:     UserRole;
}): Promise<{ error?: string }> {
  try {
    const db = createAdminClient();

    // Create auth user — email_confirm:true bypasses email confirmation flow
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email:         data.email,
      password:      data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: data.role },
    });

    if (authError) return { error: authError.message };
    const userId = authData.user.id;

    // Create seller record linked to this user
    const { data: seller, error: sellerError } = await db
      .from("sellers")
      .insert({ name: data.name, active: true, role: data.role })
      .select("id")
      .single();

    if (sellerError) {
      await db.auth.admin.deleteUser(userId);
      return { error: sellerError.message };
    }

    // Update profile (trigger already inserted row); stamp correct role + seller_id
    const { error: profileError } = await db
      .from("profiles")
      .update({ role: data.role, seller_id: seller.id })
      .eq("id", userId);

    if (profileError) return { error: profileError.message };

    return {};
  } catch (e: unknown) {
    return { error: (e as Error).message };
  }
}

// ─── Update ─────────────────────────────────────────────────────────────────────

export async function updateUser(data: {
  id:   string;
  name: string;
  role: UserRole;
}): Promise<{ error?: string }> {
  try {
    const db = createAdminClient();

    // Guard: cannot demote the last admin
    const currentRole = await getUserRole(db, data.id);
    if (currentRole === "admin" && data.role !== "admin") {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return { error: "Não é possível remover o único administrador do sistema." };
      }
    }

    const { data: profile } = await db
      .from("profiles")
      .select("seller_id")
      .eq("id", data.id)
      .single();

    // Keep user_metadata in sync so role is correct even before next DB fetch
    const [metaRes, profileRes] = await Promise.all([
      db.auth.admin.updateUserById(data.id, {
        user_metadata: { name: data.name, role: data.role },
      }),
      db.from("profiles").update({ name: data.name, role: data.role }).eq("id", data.id),
    ]);

    if (metaRes.error)    return { error: metaRes.error.message };
    if (profileRes.error) return { error: profileRes.error.message };

    if (profile?.seller_id) {
      await db
        .from("sellers")
        .update({ name: data.name, role: data.role })
        .eq("id", profile.seller_id);
    }

    return {};
  } catch (e: unknown) {
    return { error: (e as Error).message };
  }
}

// ─── Toggle active ───────────────────────────────────────────────────────────────

export async function toggleUserActive(
  userId: string,
  setActive: boolean,
): Promise<{ error?: string }> {
  try {
    const db = createAdminClient();

    // Guard: cannot deactivate the last active admin
    if (!setActive) {
      const role = await getUserRole(db, userId);
      if (role === "admin") {
        const activeAdminCount = await countActiveAdmins(db);
        if (activeAdminCount <= 1) {
          return { error: "Não é possível desativar o único administrador ativo." };
        }
      }
    }

    const { error } = await db.auth.admin.updateUserById(userId, {
      ban_duration: setActive ? "none" : "876600h",
    });
    if (error) return { error: error.message };
    return {};
  } catch (e: unknown) {
    return { error: (e as Error).message };
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  try {
    const db = createAdminClient();

    // Guard: cannot delete the last admin
    const role = await getUserRole(db, userId);
    if (role === "admin") {
      const adminCount = await countAdmins(db);
      if (adminCount <= 1) {
        return { error: "Não é possível excluir o único administrador do sistema." };
      }
    }

    const { data: profile } = await db
      .from("profiles")
      .select("seller_id")
      .eq("id", userId)
      .single();

    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };

    if (profile?.seller_id) {
      await db.from("sellers").delete().eq("id", profile.seller_id);
    }

    return {};
  } catch (e: unknown) {
    return { error: (e as Error).message };
  }
}
