import { memo } from "react";
import type { Card } from "@core/types";
import { AgentSessionProvider } from "../../context/AgentSessionContext";
import { CardListSidebar } from "./CardListSidebar";
import { TerminalPanel } from "./TerminalPanel";

interface AgentViewProps {
  cards: readonly Card[];
  selectedCardId: string | null;
  onCardSelect: (cardId: string) => void;
}

export const AgentView = memo(function AgentView({
  cards,
  selectedCardId,
  onCardSelect,
}: AgentViewProps) {
  const selectedCard = selectedCardId
    ? cards.find((c) => c.sessionUid === selectedCardId) ?? null
    : null;

  return (
    <AgentSessionProvider>
      <div className="flex h-full w-full gap-4">
        {/* Card list sidebar - 30% */}
        <div className="w-[30%] min-w-[280px] max-w-[400px] flex-shrink-0">
          <CardListSidebar
            cards={cards}
            selectedCardId={selectedCardId}
            onCardSelect={onCardSelect}
          />
        </div>

        {/* Terminal panel - 70% */}
        <div className="flex-1 min-w-0">
          <TerminalPanel selectedCard={selectedCard} />
        </div>
      </div>
    </AgentSessionProvider>
  );
});
