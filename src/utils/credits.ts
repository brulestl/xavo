import { supabase } from "../lib/supabase";
import { PLAN_LIMITS } from "../../config/plans";
import type { Tier } from "../../config/types";

export async function assertDailyCredit(userId: string, tier: Tier) {
  const cap = PLAN_LIMITS[tier].dailyPromptCap;
  const { data, error } = await supabase.rpc("fn_consume_daily", {
    p_user: userId,
    p_cap:  cap
  });
  if (error) throw error;
  if (!data) throw new Error("Daily prompt cap reached");
} 