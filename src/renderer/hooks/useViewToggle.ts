import { useState, useCallback } from "react";
import { logUserAction } from "@services/logging";
import type { ViewType } from "@core/types";

export function useViewToggle(initialView: ViewType = "kanban") {
  const [view, setView] = useState<ViewType>(initialView);

  const setViewWithLogging = useCallback(
    (newView: ViewType) => {
      logUserAction("view_toggle", `View changed to ${newView}`, {
        from: view,
        to: newView,
      });
      setView(newView);
    },
    [view]
  );

  return {
    view,
    setView: setViewWithLogging,
    isAgentView: view === "agent",
    isKanbanView: view === "kanban",
  };
}
