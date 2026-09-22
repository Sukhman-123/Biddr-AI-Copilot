import { z } from "zod";

const bidRecommendationSchema = z
  .object({
    playerId: z.string(),
    decision: z.enum(["BID", "CAUTION", "PASS"]),
    maximumBidLakh: z.number().finite(),
    nextBidLakh: z.number().finite(),
    headroomLakh: z.number().finite(),
    factors: z
      .object({
        playerValueLakh: z.number().finite(),
        nextBidLakh: z.number().finite(),
        roleTarget: z.number().int().nonnegative(),
        roleGap: z.number().int().nonnegative(),
        remainingRoleSupply: z.number().int().nonnegative(),
        scarcityScore: z.number().finite(),
        needMultiplier: z.number().finite(),
        priorityMultiplier: z.number().finite(),
        riskMultiplier: z.number().finite(),
        reserveFloorLakh: z.number().finite(),
        spendableAboveReserveLakh: z.number().finite(),
        openSquadSlots: z.number().int().nonnegative(),
        slotBudgetCapLakh: z.number().finite(),
        rawCeilingLakh: z.number().finite()
      })
      .strict(),
    reasons: z.array(z.string().min(1))
  })
  .strict();

export type PresentedBidRecommendation = z.infer<
  typeof bidRecommendationSchema
>;

export function parseBidRecommendation(
  value: unknown
): PresentedBidRecommendation | null {
  const result = bidRecommendationSchema.safeParse(value);
  return result.success ? result.data : null;
}
