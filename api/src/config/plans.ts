export type Tier = "trial" | "strategist" | "shark";

export interface PlanLimits {
  dailyPromptCap: number;   // per 24h window
  model:          "gpt-4o-mini" | "o3";
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  trial: {
    dailyPromptCap: 3,
    model: "gpt-4o-mini"
  },
  strategist: {
    dailyPromptCap: 3,
    model: "gpt-4o-mini"
  },
  shark: {
    dailyPromptCap: Number.MAX_SAFE_INTEGER,
    model: "gpt-4o-mini"
  }
}; 