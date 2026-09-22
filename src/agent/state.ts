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

export type StoredBidResult = {
  actionId: string;
  playerId: string;
  playerName: string;
  amountLakh: number;
  purseRemainingLakh: number;
  squadSize: number;
};

export type CommittedBidResult = StoredBidResult & {
  duplicate: boolean;
};

export type BiddrAgentState = {
  schemaVersion: 1;
  auction: AuctionState;
  processedActionIds: string[];
  processedBidResults: Record<string, StoredBidResult>;
};

export function createInitialAgentState(): BiddrAgentState {
  return {
    schemaVersion: 1,
    auction: createInitialAuctionState(),
    processedActionIds: [],
    processedBidResults: {}
  };
}

export function rememberAgentStrategy(
  state: BiddrAgentState,
  strategy: StrategyPreferences
): BiddrAgentState {
  return {
    ...state,
    auction: withStrategy(state.auction, strategy),
    processedActionIds: [...state.processedActionIds],
    processedBidResults: { ...state.processedBidResults }
  };
}

export function passAgentCurrentPlayer(
  state: BiddrAgentState
): BiddrAgentState {
  return {
    ...state,
    auction: passCurrentPlayer(state.auction),
    processedActionIds: [...state.processedActionIds],
    processedBidResults: { ...state.processedBidResults }
  };
}

export function advanceAgentCurrentLot(
  state: BiddrAgentState
): BiddrAgentState {
  return {
    ...state,
    auction: advanceCurrentLot(state.auction),
    processedActionIds: [...state.processedActionIds],
    processedBidResults: { ...state.processedBidResults }
  };
}

export function commitAgentBid(
  state: BiddrAgentState,
  amountLakh: number,
  actionId: string
): { state: BiddrAgentState; result: CommittedBidResult } {
  if (actionId.length === 0 || actionId.length > 256) {
    throw new Error("Approved bid is missing a valid action identifier.");
  }

  const previousResult = state.processedBidResults[actionId];
  if (previousResult) {
    return {
      state,
      result: { ...previousResult, duplicate: true }
    };
  }

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
  const result: StoredBidResult = {
    actionId,
    playerId: player.id,
    playerName: player.name,
    amountLakh,
    purseRemainingLakh: auction.purseRemainingLakh,
    squadSize: auction.squad.length
  };
  const processedActionIds = [...state.processedActionIds, actionId].slice(
    -MAX_PROCESSED_ACTION_IDS
  );
  const retainedResults = Object.fromEntries(
    processedActionIds.flatMap((id) => {
      const stored = id === actionId ? result : state.processedBidResults[id];
      return stored ? [[id, stored]] : [];
    })
  );
  const nextState: BiddrAgentState = {
    ...state,
    auction,
    processedActionIds,
    processedBidResults: retainedResults
  };

  return {
    state: nextState,
    result: { ...result, duplicate: false }
  };
}

export function resetAgentState(): BiddrAgentState {
  return createInitialAgentState();
}
