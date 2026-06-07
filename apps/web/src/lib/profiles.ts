import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { User as AppUser } from "@project-gestion/types";

interface ProfileRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function toUser(row: ProfileRow, user: User): AppUser {
  return {
    id: row.id,
    email: user.email ?? "",
    name: row.name ?? undefined,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getStringMetadata(user: User, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getInitialProfileValues(user: User) {
  return {
    id: user.id,
    name: getStringMetadata(user, "name") ?? getStringMetadata(user, "full_name"),
    avatar_url:
      getStringMetadata(user, "avatar_url") ?? getStringMetadata(user, "picture"),
  };
}

async function selectOwnProfile(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toUser(data as ProfileRow, user) : null;
}

export async function getCurrentUserProfile(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return null;
  }

  return selectOwnProfile(supabase, user);
}

export async function getOrCreateCurrentUserProfile(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return null;
  }

  const existingProfile = await selectOwnProfile(supabase, user);

  if (existingProfile) {
    return existingProfile;
  }

  const { data, error: insertError } = await supabase
    .from("profiles")
    .insert(getInitialProfileValues(user))
    .select("id, name, avatar_url, created_at, updated_at")
    .single();

  if (!insertError) {
    return toUser(data as ProfileRow, user);
  }

  if (insertError.code === "23505") {
    return selectOwnProfile(supabase, user);
  }

  throw insertError;
}
