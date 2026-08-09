import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser validates the token with Supabase and refreshes cookies when required.
  const { data: { user } } = await supabase.auth.getUser();
  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isPublicShell = request.nextUrl.pathname === "/offline-workout"
    || request.nextUrl.pathname === "/manifest.webmanifest"
    || request.nextUrl.pathname === "/sw.js"
    || request.nextUrl.pathname === "/apple-icon";

  if (!user && !isLoginRoute && !isPublicShell) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
