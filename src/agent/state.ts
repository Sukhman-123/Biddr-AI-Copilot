import { createInitialAuctionState, type AuctionState } from "../domain";

export type BiddrAgentState = {
  schemaVersion: 1;
  auction: AuctionState;
  processedActionIds: string[];
};

export function createInitialAgentState(): BiddrAgentState {
  return {
    schemaVersion: 1,
    auction: createInitialAuctionState(),
    processedActionIds: []
  };
}

