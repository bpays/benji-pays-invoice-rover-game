import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_DOMAIN = "benjipays.com";

function getJwtAal(authHeader: string): string | null {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims?.aal === "string" ? claims.aal : null;
  } catch (_err) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerDomain = caller.email?.split("@")[1]?.toLowerCase();
    if (callerDomain !== ALLOWED_DOMAIN) {
      return new Response(JSON.stringify({ error: "Access restricted to @" + ALLOWED_DOMAIN }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce MFA (aal2) for all admin actions except the initial role claim
    const { action, email, role, user_id } = await req.json();

    if (action !== "claim") {
      if (getJwtAal(authHeader) !== "aal2") {
        return new Response(
          JSON.stringify({ error: "MFA (aal2) required" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── INVITE: insert into admin_invites ──
    if (action === "invite") {
      // Only admins can invite
      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin");

      if (!callerRoles || callerRoles.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const invitedDomain = email.split("@")[1]?.toLowerCase();
      if (invitedDomain !== ALLOWED_DOMAIN) {
        return new Response(JSON.stringify({ error: "Can only invite @" + ALLOWED_DOMAIN + " emails" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertErr } = await adminClient
        .from("admin_invites")
        .upsert(
          { email: email.toLowerCase(), role: role || "admin", invited_by: caller.id },
          { onConflict: "email", ignoreDuplicates: true }
        );

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CLAIM: called on first Google sign-in to assign role from invite ──
    if (action === "claim") {
      const callerEmail = caller.email?.toLowerCase();
      if (!callerEmail) {
        return new Response(JSON.stringify({ error: "No email on account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invite } = await adminClient
        .from("admin_invites")
        .select("role")
        .eq("email", callerEmail)
        .maybeSingle();

      if (!invite) {
        return new Response(JSON.stringify({ error: "No invite found for this email" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Assign role
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .upsert(
          { user_id: caller.id, role: invite.role },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      if (roleErr) {
        return new Response(JSON.stringify({ error: roleErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete the invite record
      await adminClient
        .from("admin_invites")
        .delete()
        .eq("email", callerEmail);

      return new Response(JSON.stringify({ success: true, role: invite.role }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST: combined active admins + pending invites ──
    if (action === "list") {
      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin");

      if (!callerRoles || callerRoles.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Active admins from user_roles
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const admins = [];
      if (roles) {
        const userIds = [...new Set(roles.map((r: any) => r.user_id))];
        for (const uid of userIds) {
          const { data: { user } } = await adminClient.auth.admin.getUserById(uid as string);
          if (user) {
            const userRoles = roles.filter((r: any) => r.user_id === uid);
            admins.push({
              user_id: uid,
              email: user.email,
              roles: userRoles.map((r: any) => r.role),
              created_at: user.created_at,
              status: "active",
            });
          }
        }
      }

      // Pending invites
      const { data: invites } = await adminClient
        .from("admin_invites")
        .select("id, email, role, created_at");

      const pending = (invites || []).map((inv: any) => ({
        invite_id: inv.id,
        email: inv.email,
        roles: [inv.role],
        created_at: inv.created_at,
        status: "pending",
      }));

      return new Response(JSON.stringify({ admins: [...admins, ...pending] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REMOVE: delete from user_roles and/or admin_invites ──
    if (action === "remove") {
      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin");

      if (!callerRoles || callerRoles.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove active admin by user_id
      if (user_id) {
        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot remove your own admin role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", role || "admin");

        // Reset MFA: unenroll all factors for the removed user
        try {
          const mfaData = await adminClient.auth.mfa.listFactors();
          // Use admin API to get the user's factors
          const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);
          if (targetUser?.user?.factors && targetUser.user.factors.length > 0) {
            for (const factor of targetUser.user.factors) {
              await (adminClient.auth.admin.mfa as any).deleteFactor({
                userId: user_id,
                id: factor.id,
              });
            }
          }
        } catch (mfaErr) {
          // Log but don't fail the removal if MFA reset fails
          console.error("MFA reset error:", mfaErr);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove pending invite by email
      if (email) {
        await adminClient
          .from("admin_invites")
          .delete()
          .eq("email", email.toLowerCase());

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "user_id or email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-invite unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
