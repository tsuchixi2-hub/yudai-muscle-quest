import { clearCookie, json, jsonHeaders, logAuthEvent, temporaryCookie } from "../../_auth.js";

function base64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkcePair() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge:base64Url(new Uint8Array(digest)) };
}

export async function onRequestGet({ request, env, waitUntil }) {
  if (!env.LINE_CHANNEL_ID || !env.LINE_CALLBACK_URL) {
    return json({
      error:"line_not_configured",
      message:"LINE DevelopersのChannel ID/Callback URLを設定すると本番LINEログインに接続できます。"
    }, 501);
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const pkce = await createPkcePair();
  const ua = request.headers.get("user-agent") || "";
  const isAndroid = /Android/i.test(ua);
  const isLineInApp = /\bLine\//i.test(ua);
  const mode = url.searchParams.get("mode");
  const lineUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  lineUrl.searchParams.set("response_type", "code");
  lineUrl.searchParams.set("client_id", env.LINE_CHANNEL_ID);
  lineUrl.searchParams.set("redirect_uri", env.LINE_CALLBACK_URL);
  lineUrl.searchParams.set("state", state);
  lineUrl.searchParams.set("scope", "openid profile");
  lineUrl.searchParams.set("nonce", nonce);
  lineUrl.searchParams.set("code_challenge", pkce.challenge);
  lineUrl.searchParams.set("code_challenge_method", "S256");
  // LINEアプリ内ブラウザは auto login が最も安定するため無効化しない。
  // Android の通常ブラウザは既定で Web ログイン（安全側）。mode=app でアプリ起動を試せる。
  if (mode === "web" || (isAndroid && !isLineInApp && mode !== "app")) {
    lineUrl.searchParams.set("disable_auto_login", "true");
  }

  const logDetail = JSON.stringify({
    mode:mode || "",
    android:isAndroid,
    lineInApp:isLineInApp,
    disableAutoLogin:lineUrl.searchParams.get("disable_auto_login") === "true"
  });
  const logPromise = logAuthEvent(env, "start", logDetail, request);
  if (typeof waitUntil === "function") {
    waitUntil(logPromise);
  } else {
    await logPromise;
  }

  if ((request.headers.get("accept") || "").includes("application/json")) {
    const headers = new Headers(jsonHeaders);
    headers.append("set-cookie", temporaryCookie("ymq_line_state", state, 600, request));
    headers.append("set-cookie", temporaryCookie("ymq_line_verifier", pkce.verifier, 600, request));
    headers.append("set-cookie", temporaryCookie("ymq_line_return", returnTo, 600, request));
    if (url.searchParams.get("mode") !== "web") {
      headers.append("set-cookie", clearCookie("ymq_line_retry", request));
    }
    return new Response(JSON.stringify({ authUrl:lineUrl.toString() }), { status:200, headers });
  }

  const headers = new Headers({ "location":lineUrl.toString() });
  headers.append("set-cookie", temporaryCookie("ymq_line_state", state, 600, request));
  headers.append("set-cookie", temporaryCookie("ymq_line_verifier", pkce.verifier, 600, request));
  headers.append("set-cookie", temporaryCookie("ymq_line_return", returnTo, 600, request));
  if (url.searchParams.get("mode") !== "web") {
    headers.append("set-cookie", clearCookie("ymq_line_retry", request));
  }
  return new Response(null, { status:302, headers });
}
