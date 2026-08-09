"use server";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export interface LoginState {
  message?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!getSupabasePublicConfig()) {
    return { message: "Authentication is not connected yet. The local interface remains available in demo mode." };
  }

  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(validated.data);

  if (error) return { message: "The email or password was not accepted." };
  redirect("/");
}

export async function signup(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!getSupabasePublicConfig()) return { message: "Authentication is not connected yet." };
  const validated = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!validated.success) return { fieldErrors: validated.error.flatten().fieldErrors };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(validated.data);
  if (error) return { message: error.message.includes("disabled") ? "New account registration is currently disabled." : "Your account could not be created. Try another email or password." };
  if (!data.session) return { message: "Account created. Check your email to confirm it, then sign in." };
  redirect("/");
}
