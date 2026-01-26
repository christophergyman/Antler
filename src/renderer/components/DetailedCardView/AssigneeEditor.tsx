/**
 * AssigneeEditor Component
 * Multi-select for assignees from repository collaborators
 */

import { memo, useCallback } from "react";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useCombobox } from "./hooks";
import type { AssigneeEditorProps } from "./types";

export const AssigneeEditor = memo(function AssigneeEditor({
  assignees,
  availableCollaborators,
  onChange,
}: AssigneeEditorProps) {
  const {
    search,
    setSearch,
    isOpen,
    setIsOpen,
    filteredItems: filteredCollaborators,
    handleBlur,
    handleEscape,
    reset,
  } = useCombobox({
    items: availableCollaborators,
    selectedItems: assignees,
    getItemLabel: (c) => c,
  });

  const handleRemoveAssignee = useCallback(
    (assigneeToRemove: string) => {
      onChange(assignees.filter((a) => a !== assigneeToRemove));
    },
    [assignees, onChange]
  );

  const handleAddAssignee = useCallback(
    (assignee: string) => {
      if (!assignees.includes(assignee)) {
        onChange([...assignees, assignee]);
      }
      reset();
    },
    [assignees, onChange, reset]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleEscape();
      }
    },
    [handleEscape]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {assignees.map((assignee) => (
          <Badge
            key={assignee}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {assignee}
            <button
              onClick={() => handleRemoveAssignee(assignee)}
              className="ml-1 rounded-full hover:bg-gray-300 p-0.5"
              aria-label={`Remove ${assignee}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Add assignee..."
          className="w-full"
        />
        {isOpen && filteredCollaborators.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
            {filteredCollaborators.map((collaborator) => (
              <button
                key={collaborator}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddAssignee(collaborator);
                }}
              >
                {collaborator}
              </button>
            ))}
          </div>
        )}
        {isOpen && filteredCollaborators.length === 0 && search && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm text-gray-500">
            No collaborators found
          </div>
        )}
      </div>
    </div>
  );
});
