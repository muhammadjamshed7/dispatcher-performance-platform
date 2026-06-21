import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? process.env.RESET_USER_EMAIL ?? "").trim().toLowerCase();
const newPassword = process.argv[3] ?? process.env.RESET_USER_PASSWORD ?? "";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
    );
  }

  if (!email) {
    throw new Error(
      "Usage: npm run reset-password -- <email> <new-password>\nExample: npm run reset-password -- user@example.com your-new-password",
    );
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    throw new Error(listError.message);
  }

  const user = listData.users.find(
    (entry) => entry.email?.toLowerCase() === email,
  );

  if (!user) {
    throw new Error(`No Supabase Auth user found for ${email}`);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword },
  );

  if (updateError) {
    throw new Error(updateError.message);
  }

  console.log(`Password updated for ${email}`);
  console.log(`User ID: ${user.id}`);
  console.log("Sign in at /dispatcher/login (or the portal matching their role).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
