const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

const errors = [];
for (const name of required) {
  const value = process.env[name];
  if (!value || /replace_me|your-project|example\.com/i.test(value)) errors.push(`${name} is missing or still a placeholder`);
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    if (new URL(value).protocol !== "https:") errors.push(`${name} must use HTTPS for deployment`);
  } catch { errors.push(`${name} must be a valid absolute URL`); }
}

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
if (publishableKey && !publishableKey.startsWith("sb_publishable_")) {
  errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be the browser-safe publishable key");
}
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  errors.push("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must never exist; service-role credentials cannot be public");
}

if (errors.length > 0) {
  process.stderr.write(`Deployment environment is invalid:\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write("Deployment environment contract is valid. No secret values were printed.\n");
