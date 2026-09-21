import {
  advanceCurrentLot,
  commitBid,
  createInitialAuctionState,
  getCurrentPlayer,
  passCurrentPlayer,
  withStrategy,
  type AuctionState,
  type StrategyPreferences
} from "../domain";

const MAX_PROCESSED_ACTION_IDS = 50;

export type CommittedBidResult = {
  actionId: string;
  duplicate: boolean;
  playerId: string;
  playerName: string;
  amountLakh: number;
  purseRemainingLakh: number;
  squadSize: number;
};

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

export function commitAgentBid(
  state: BiddrAgentState,
  amountLakh: number,
  actionId: string
): { state: BiddrAgentState; result: CommittedBidResult } {
  if (state.processedActionIds.includes(actionId)) {
    return {
      state,
      result: {
        actionId,
        duplicate: true,
        playerId: "already-processed",
        playerName: "Previously processed bid",
        amountLakh,
        purseRemainingLakh: state.auction.purseRemainingLakh,
        squadSize: state.auction.squad.length
      }
    };
  }

  const player = getCurrentPlayer(state.auction);
  if (!player) {
    throw new Error("The auction has no active player to bid on.");
  }

  const auction = commitBid(state.auction, amountLakh);
  const nextState: BiddrAgentState = {
    ...state,
    auction,
    processedActionIds: [...state.processedActionIds, actionId].slice(
      -MAX_PROCESSED_ACTION_IDS
    )
  };

  return {
    state: nextState,
    result: {
      actionId,
      duplicate: false,
      playerId: player.id,
      playerName: player.name,
      amountLakh,
      purseRemainingLakh: auction.purseRemainingLakh,
      squadSize: auction.squad.length
    }
  };
}

export function resetAgentState(): BiddrAgentState {
  return createInitialAgentState();
}
