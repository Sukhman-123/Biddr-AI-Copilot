import {
  advanceCurrentLot,
  createInitialAuctionState,
  passCurrentPlayer,
  withStrategy,
  type AuctionState,
  type StrategyPreferences
} from "../domain";

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

export function rememberAgentStrategy(
  state: BiddrAgentState,
  strategy: StrategyPreferences
): BiddrAgentState {
  return {
    ...state,
    auction: withStrategy(state.auction, strategy),
    processedActionIds: [...state.processedActionIds]
  };
}

export function passAgentCurrentPlayer(
  state: BiddrAgentState
): BiddrAgentState {
  return {
    ...state,
    auction: passCurrentPlayer(state.auction),
    processedActionIds: [...state.processedActionIds]
  };
}

export function advanceAgentCurrentLot(
  state: BiddrAgentState
): BiddrAgentState {
  return {
    ...state,
    auction: advanceCurrentLot(state.auction),
    processedActionIds: [...state.processedActionIds]
  };
}

export function resetAgentState(): BiddrAgentState {
  return createInitialAgentState();
}
