import { z } from "zod";
import { PLAYER_ROLES } from "../domain";

export const strategyPreferencesSchema = z
  .object({
    reservePercent: z.number().int().min(0).max(90),
    riskTolerance: z.enum(["conservative", "balanced", "aggressive"]),
    priorityRoles: z
      .array(z.enum(PLAYER_ROLES))
      .max(PLAYER_ROLES.length)
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Priority roles must not contain duplicates."
      })
  })
  .strict();

