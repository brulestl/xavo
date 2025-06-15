import { Router } from "express";
import { assertDailyCredit } from "../utils/credits";
import { callCoachAssistant } from "../openai";
import type { Tier } from "../../config/types";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const uid  = req.header("x-user")!;
    const tier = (req.header("x-tier") || "trial") as Tier;

    await assertDailyCredit(uid, tier);

    const reply = await callCoachAssistant(req.body.messages);

    res.json(reply.choices[0].message);
  } catch (err) {
    res.status(429).json({ error: (err as Error).message });
  }
});

export default router; 