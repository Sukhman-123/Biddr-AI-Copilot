import { z } from "zod";
import {
  PLAYER_ROLES,
  assertAuctionState
} from "../domain";
import type { BiddrAgentState } from "./state";

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

const playerRoleSchema = z.enum(PLAYER_ROLES);

const playerSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(160),
    role: playerRoleSchema,
    style: z.string().min(1).max(300),
    basePriceLakh: z.number().int().nonnegative(),
    estimatedValueLakh: z.number().int().nonnegative(),
    rating: z.number().int().min(0).max(100)
  })
  .strict();

const squadMemberSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    name: z.string().min(1).max(160),
    role: playerRoleSchema,
    acquisitionPriceLakh: z.number().int().nonnegative(),
    source: z.enum(["retained", "auction"])
  })
  .strict();

const currentBidSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    amountLakh: z.number().int().nonnegative(),
    bidder: z.string().min(1).max(160)
  })
  .strict();

const lotResultSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    outcome: z.enum(["won", "passed", "sold-elsewhere", "unsold"]),
    amountLakh: z.number().int().nonnegative().nullable(),
    winner: z.string().min(1).max(160).nullable()
  })
  .strict();

const bidRecordSchema = z
  .object({
    sequence: z.number().int().positive(),
    playerId: z.string().min(1).max(128),
    amountLakh: z.number().int().nonnegative(),
    bidder: z.string().min(1).max(160)
  })
  .strict();

const auctionEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    type: z.enum([
      "auction-started",
      "bid-won",
      "player-passed",
      "lot-advanced"
    ]),
    playerId: z.string().min(1).max(128),
    description: z.string().min(1).max(500)
  })
  .strict();

export const auctionStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    auctionId: z.string().min(1).max(128),
    teamName: z.string().min(1).max(160),
    status: z.enum(["active", "complete"]),
    initialPurseLakh: z.number().int().nonnegative(),
    purseRemainingLakh: z.number().int().nonnegative(),
    squadLimit: z.number().int().positive().max(100),
    squad: z.array(squadMemberSchema).max(100),
    playerQueue: z.array(playerSchema).min(1).max(100),
    currentLotIndex: z.number().int().nonnegative(),
    currentBid: currentBidSchema.nullable(),
    results: z.record(z.string().min(1).max(128), lotResultSchema),
    bidHistory: z.array(bidRecordSchema).max(500),
    eventLog: z.array(auctionEventSchema).max(500),
    strategy: strategyPreferencesSchema
  })
  .strict();

export const biddrAgentStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    auction: auctionStateSchema,
    processedActionIds: z.array(z.string().min(1).max(256)).max(50),
    processedBidResults: z
      .record(
        z.string().min(1).max(256),
        z
          .object({
            actionId: z.string().min(1).max(256),
            playerId: z.string().min(1).max(128),
            playerName: z.string().min(1).max(160),
            amountLakh: z.number().int().positive(),
            purseRemainingLakh: z.number().int().nonnegative(),
            squadSize: z.number().int().nonnegative()
          })
          .strict()
      )
      .default({})
  })
  .strict()
  .refine(
    (state) =>
      new Set(state.processedActionIds).size === state.processedActionIds.length,
    { message: "Processed action IDs must not contain duplicates." }
  )
  .refine(
    (state) =>
      Object.entries(state.processedBidResults).every(
        ([actionId, result]) =>
          state.processedActionIds.includes(actionId) && result.actionId === actionId
      ),
    {
      message:
        "Stored bid results must belong to a retained processed action identifier."
    }
  );

export function parseBiddrAgentState(value: unknown): BiddrAgentState {
  const state = biddrAgentStateSchema.parse(value);
  assertAuctionState(state.auction);
  return state;
}
