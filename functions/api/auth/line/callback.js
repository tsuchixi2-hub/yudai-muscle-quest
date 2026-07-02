import { json } from "../../_auth.js";

export async function onRequestGet() {
  return json({
    error:"line_not_configured",
    message:"LINEログインは次フェーズでChannel ID/Secretを設定して接続します。"
  }, 501);
}
