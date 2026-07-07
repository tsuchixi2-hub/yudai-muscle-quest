import { authErrorPage, clearCookie, createSession, getSessionUser, json, logAuthEvent, normalizeUser, parseCookies, sessionCookie, temporaryCookie } from "../../_auth.js";

function redirectToLineRetry(url, returnTo, request) {
  const retryUrl = new URL("/api/auth/line/start", url.origin);
  retryUrl.searchParams.set("returnTo", returnTo || "/");
  retryUrl.searchParams.set("mode", "web");
  const headers = new Headers({ "location":retryUrl.pathname + retryUrl.search });
  headers.append("set-cookie", clearCookie("ymq_line_state", request));
  headers.append("set-cookie", clearCookie("ymq_line_verifier", request));
  headers.append("set-cookie", clearCookie("ymq_line_return", request));
  headers.append("set-cookie", temporaryCookie("ymq_line_retry", "1", 600, request));
  return new Response(null, { status:302, headers });
}

export async function onRequestGet({ request, env, waitUntil }) {
  function log(stage, detail) {
    const logPromise = logAuthEvent(env, stage, detail || "", request);
    if (typeof waitUntil === "function") {
      waitUntil(logPromise);
      return Promise.resolve();
    }
    return logPromise;
  }

  if (!env.LINE_CHANNEL_ID || !env.LINE_CHANNEL_SECRET || !env.LINE_CALLBACK_URL) {
    return json({
      error:"line_not_configured",
      message:"LINE DevelopersのChannel ID/Secret/Callback URLを設定すると本番LINEログインに接続できます。"
    }, 501);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(request);
  const returnTo = cookies.ymq_line_return || "/";

  if (!code || !state || state !== cookies.ymq_line_state) {
    // 既に有効なセッションがある場合（二重実行・戻る操作等）はエラーにせずそのまま戻す
    const existingUser = await getSessionUser(request, env);
    if (existingUser) {
      await log("callback_already_logged_in", "");
      const redirectUrl = new URL(returnTo, url.origin);
      return new Response(null, {
        status:302,
        headers:{ "location":redirectUrl.pathname + redirectUrl.search + redirectUrl.hash }
      });
    }

    if (code && state && cookies.ymq_line_retry !== "1") {
      await log("callback_retry", "state_mismatch");
      return redirectToLineRetry(url, returnTo, request);
    }
    await log("callback_state_mismatch", "");
    return authErrorPage(request, {
      title:"ログインに失敗しました",
      message:"LINEログインの認証情報を確認できませんでした。お手数ですが、もう一度ログインをお試しください。",
      returnTo,
      code:"invalid_line_state",
      status:400
    });
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", env.LINE_CALLBACK_URL);
  tokenBody.set("client_id", env.LINE_CHANNEL_ID);
  tokenBody.set("client_secret", env.LINE_CHANNEL_SECRET);
  if (cookies.ymq_line_verifier) {
    tokenBody.set("code_verifier", cookies.ymq_line_verifier);
  }

  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method:"POST",
    headers:{ "content-type":"application/x-www-form-urlencoded" },
    body:tokenBody
  });
  if (!tokenResponse.ok) {
    if (cookies.ymq_line_retry !== "1") {
      await log("callback_retry", "token_failed");
      return redirectToLineRetry(url, returnTo, request);
    }
    await log("callback_token_failed", "");
    return authErrorPage(request, {
      title:"ログインに失敗しました",
      message:"LINEとの通信でエラーが発生しました。時間をおいて再度お試しいただくか、Web画面からのログインをお試しください。",
      returnTo,
      code:"line_token_failed",
      status:502
    });
  }
  const token = await tokenResponse.json();

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers:{ "authorization":`Bearer ${token.access_token}` }
  });
  if (!profileResponse.ok) {
    await log("callback_profile_failed", "profile_failed");
    return authErrorPage(request, {
      title:"ログインに失敗しました",
      message:"LINEのプロフィール情報を取得できませんでした。時間をおいて再度お試しください。",
      returnTo,
      code:"line_profile_failed",
      status:502
    });
  }
  const profile = await profileResponse.json();
  if (!profile.userId) {
    await log("callback_profile_failed", "profile_missing");
    return authErrorPage(request, {
      title:"ログインに失敗しました",
      message:"LINEのプロフィール情報を取得できませんでした。時間をおいて再度お試しください。",
      returnTo,
      code:"line_profile_missing",
      status:502
    });
  }

  const now = new Date().toISOString();
  let user = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     WHERE line_user_id = ?`
  ).bind(profile.userId).first();

  if (!user) {
    const id = `user-${crypto.randomUUID()}`;
    const displayName = String(profile.displayName || "LINEユーザー").slice(0, 32);
    await env.DB.prepare(
      `INSERT INTO users (id, line_user_id, demo_key, display_name, public_name, picture_url, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
    ).bind(id, profile.userId, displayName, "LINEユーザー", profile.pictureUrl || "", now, now).run();
    user = await env.DB.prepare(
      `SELECT id, display_name, public_name, picture_url
       FROM users
       WHERE id = ?`
    ).bind(id).first();
  } else {
    await env.DB.prepare(
      `UPDATE users
       SET display_name = ?, picture_url = ?, updated_at = ?
       WHERE id = ?`
    ).bind(String(profile.displayName || user.display_name).slice(0, 32), profile.pictureUrl || "", now, user.id).run();
    user = { ...user, display_name:String(profile.displayName || user.display_name).slice(0, 32), picture_url:profile.pictureUrl || "" };
  }

  const session = await createSession(env, user.id);
  const redirectUrl = new URL(returnTo, url.origin);
  redirectUrl.searchParams.set("nickname", "1");

  await log("callback_ok", "");

  const headers = new Headers({ "location":redirectUrl.pathname + redirectUrl.search + redirectUrl.hash });
  headers.append("set-cookie", sessionCookie(session.id, session.expiresAt, request));
  headers.append("set-cookie", clearCookie("ymq_line_state", request));
  headers.append("set-cookie", clearCookie("ymq_line_verifier", request));
  headers.append("set-cookie", clearCookie("ymq_line_return", request));
  headers.append("set-cookie", clearCookie("ymq_line_retry", request));
  return new Response(null, { status:302, headers });
}
