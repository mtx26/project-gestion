import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSupabaseAuthClient } from "@project-gestion/auth";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase public environment variables.");
}

export const supabase = createSupabaseAuthClient({
  url: supabaseUrl,
  anonKey: supabaseKey,
  storage: AsyncStorage,
  detectSessionInUrl: false,
});
