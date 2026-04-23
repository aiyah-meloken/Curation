#!/usr/bin/env node
// Standalone Authing OIDC verification probe.
// Runs a local HTTP server on 127.0.0.1:53682 (already whitelisted in Authing),
// walks the full Authorization Code + PKCE flow, then probes:
//   - token endpoint response (all three tokens decoded)
//   - /oidc/me (userinfo) with access_token as Bearer
//   - /oidc/token/introspection with access_token
//   - backend /auth/me with access_token AND id_token
//
// Writes JSON report to ./auth-verification.json and prints to stdout.
//
// Usage:
//   node scripts/verify-auth.mjs
//   API_BASE=https://curationcurationcuration.cc node scripts/verify-auth.mjs  # probe prod
//
// Does NOT modify any app code or DB.

import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const APP_ID = "69c60580869b64ce6c76bb77";
const DOMAIN = "https://curation.authing.cn";
const REDIRECT_URI = "http://127.0.0.1:53682/callback";
const SCOPE = "openid profile email phone offline_access username roles external_id extended_fields address";
const API_BASE = process.env.API_BASE || "http://127.0.0.1:8889";

// --- PKCE ---
const b64url = (buf) =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

const authUrl =
  `${DOMAIN}/oidc/auth?` +
  new URLSearchParams({
    response_type: "code",
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

// --- JWT decode (no verify) ---
function decodeJwt(t) {
  if (!t || typeof t !== "string") return { missing: true };
  const parts = t.split(".");
  if (parts.length !== 3) {
    return { not_a_jwt: true, preview: t.slice(0, 40), length: t.length };
  }
  const dec = (s) =>
    JSON.parse(
      Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
  try {
    return { header: dec(parts[0]), payload: dec(parts[1]) };
  } catch (e) {
    return { decode_error: e.message, preview: t.slice(0, 40) };
  }
}

// --- main flow ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:53682");
  if (!url.pathname.startsWith("/callback")) {
    res.statusCode = 404;
    return res.end("not found");
  }

  const code = url.searchParams.get("code");
  const gotState = url.searchParams.get("state");
  if (!code || gotState !== state) {
    res.statusCode = 400;
    return res.end("bad callback: " + req.url);
  }

  const report = {
    timestamp: new Date().toISOString(),
    domain: DOMAIN,
    app_id: APP_ID,
    scope_requested: SCOPE,
    api_base: API_BASE,
  };

  // 1. token exchange
  try {
    const r = await fetch(`${DOMAIN}/oidc/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: APP_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    report.token_endpoint_status = r.status;
    const tokens = await r.json();
    report.token_response_keys = Object.keys(tokens);
    report.token_response_full = tokens;

    report.accessToken_decoded = decodeJwt(tokens.access_token);
    report.idToken_decoded = decodeJwt(tokens.id_token);
    report.refreshToken_preview = tokens.refresh_token
      ? `${tokens.refresh_token.slice(0, 20)}… (len=${tokens.refresh_token.length})`
      : null;
    report.refreshToken_is_jwt =
      !!tokens.refresh_token && tokens.refresh_token.split(".").length === 3;

    // 2. userinfo
    try {
      const u = await fetch(`${DOMAIN}/oidc/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      report.userinfo_status = u.status;
      const ct = u.headers.get("content-type") || "";
      report.userinfo_body = ct.includes("json") ? await u.json() : await u.text();
    } catch (e) {
      report.userinfo_error = String(e);
    }

    // 3. introspection (public client, no secret)
    try {
      const i = await fetch(`${DOMAIN}/oidc/token/introspection`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: tokens.access_token, client_id: APP_ID }),
      });
      report.introspection_status = i.status;
      const ct = i.headers.get("content-type") || "";
      report.introspection_body = ct.includes("json") ? await i.json() : await i.text();
    } catch (e) {
      report.introspection_error = String(e);
    }

    // 4. backend /auth/me with access_token
    try {
      const r1 = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      report.backend_me_with_access_token = {
        status: r1.status,
        body: await r1.text(),
      };
    } catch (e) {
      report.backend_me_with_access_token = { error: String(e) };
    }

    // 5. backend /auth/me with id_token (current prod behavior)
    try {
      const r2 = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.id_token}` },
      });
      report.backend_me_with_id_token = {
        status: r2.status,
        body: await r2.text(),
      };
    } catch (e) {
      report.backend_me_with_id_token = { error: String(e) };
    }

    // 6. discovery document (for reference)
    try {
      const d = await fetch(`${DOMAIN}/oidc/.well-known/openid-configuration`);
      report.discovery_keys = Object.keys(await d.json());
    } catch {}
  } catch (e) {
    report.fatal_error = String(e);
  }

  // respond to browser
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!DOCTYPE html><html><body style="background:#111;color:#ddd;font-family:ui-monospace,monospace;padding:24px;">
<h2>Auth verification complete ✓</h2>
<p>Check the terminal for the JSON report.</p>
<p>You can close this window.</p>
</body></html>`);

  // write + print
  const outPath = path.resolve(process.cwd(), "auth-verification.json");
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  console.log("\n=== AUTH VERIFICATION REPORT ===\n");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n✓ Written to: ${outPath}\n`);

  setTimeout(() => process.exit(0), 300);
});

server.listen(53682, "127.0.0.1", () => {
  console.log(`Listening on http://127.0.0.1:53682/callback`);
  console.log(`API_BASE = ${API_BASE}`);
  console.log(`\nOpening browser to Authing…\n${authUrl}\n`);
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${openCmd} "${authUrl}"`);
});
