// Asset Tagger: invite / create / assign / delete users. Runs server-side with the service role key
// (never shipped to the browser). Caller must be signed in; permissions are checked here:
//   god   – any role, any site, delete users
//   admin – may only add role 'user' to sites they administer
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const APP_URL = "https://aperry1320.github.io/asset-tagger/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json({ error: "Not signed in" }, 401);
  const { data: me } = await admin.from("profiles").select("id,role").eq("id", u.user.id).single();
  if (!me || (me.role !== "god" && me.role !== "admin")) return json({ error: "Only God or Admin accounts can manage users" }, 403);
  const isGod = me.role === "god";

  let body: any; try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = body.action || "invite";

  const adminsSite = async (sid: string) => {
    if (isGod) return true;
    const { data } = await admin.from("site_admins").select("site_id").eq("site_id", sid).eq("user_id", me.id).maybeSingle();
    return !!data;
  };

  if (action === "delete") {
    if (!isGod) return json({ error: "Only God can delete accounts" }, 403);
    if (!body.user_id || body.user_id === me.id) return json({ error: "Bad user" }, 400);
    const { error } = await admin.auth.admin.deleteUser(body.user_id);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  if (action !== "invite") return json({ error: "Unknown action" }, 400);
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "user");
  const site = body.site_id ? String(body.site_id) : "";
  const fullName = String(body.full_name || "").trim().slice(0, 120);
  const password = body.password ? String(body.password) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email" }, 400);
  if (!["god", "admin", "user"].includes(role)) return json({ error: "Bad role" }, 400);
  if (!isGod && role !== "user") return json({ error: "Admins can only add Users" }, 403);
  if (!isGod && !site) return json({ error: "Choose one of your sites" }, 400);
  if (site && !(await adminsSite(site))) return json({ error: "You don't manage that site" }, 403);
  if (password && password.length < 8) return json({ error: "Temporary password must be at least 8 characters" }, 400);

  // Existing account?
  let { data: prof } = await admin.from("profiles").select("id,role,email").eq("email", email).maybeSingle();
  let created = false, emailed = false;
  if (!prof) {
    let res;
    if (password) res = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    else res = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: body.redirect_to || APP_URL, data: { full_name: fullName } });
    if (res.error) return json({ error: res.error.message }, 400);
    created = true; emailed = !password;
    const id = res.data.user!.id;
    await admin.from("profiles").upsert({ id, email, full_name: fullName, role: "user" }, { onConflict: "id" });
    prof = { id, role: "user", email };
  }
  // Role: god may set any role; nobody is ever downgraded by an admin's invite.
  const rank: Record<string, number> = { user: 0, admin: 1, god: 2 };
  let newRole = prof.role;
  if (isGod && body.set_role) newRole = role;
  else if (rank[role] > rank[prof.role]) newRole = role;
  if (newRole !== prof.role) {
    const { error } = await admin.from("profiles").update({ role: newRole }).eq("id", prof.id);
    if (error) return json({ error: error.message }, 400);
  }
  if (fullName) await admin.from("profiles").update({ full_name: fullName }).eq("id", prof.id).eq("full_name", "");
  if (site) {
    const table = role === "admin" ? "site_admins" : "site_members";
    const { error } = await admin.from(table).upsert({ site_id: site, user_id: prof.id }, { onConflict: "site_id,user_id", ignoreDuplicates: true });
    if (error) return json({ error: error.message }, 400);
  }
  return json({ ok: true, user_id: prof.id, created, emailed, role: newRole });
});
