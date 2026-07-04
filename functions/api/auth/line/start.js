import { json, temporaryCookie } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
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
  const lineUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  lineUrl.searchParams.set("response_type", "code");
  lineUrl.searchParams.set("client_id", env.LINE_CHANNEL_ID);
  lineUrl.searchParams.set("redirect_uri", env.LINE_CALLBACK_URL);
  lineUrl.searchParams.set("state", state);
  lineUrl.searchParams.set("scope", "openid profile");
  lineUrl.searchParams.set("nonce", nonce);

  if ((request.headers.get("accept") || "").includes("application/json")) {
    return json({ authUrl:lineUrl.toString() }, 200, {
      "set-cookie":temporaryCookie("ymq_line_state", state, 600, request)
    });
  }

  const headers = new Headers({ "location":lineUrl.toString() });
  headers.append("set-cookie", temporaryCookie("ymq_line_state", state, 600, request));
  headers.append("set-cookie", temporaryCookie("ymq_line_return", returnTo, 600, request));
  return new Response(null, { status:302, headers });
}
