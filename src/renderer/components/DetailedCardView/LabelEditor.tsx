/**
 * LabelEditor Component
 * Multi-select badges for labels with ability to add new ones
 */

import { memo, useCallback } from "react";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useCombobox } from "./hooks";
import type { LabelEditorProps } from "./types";

export const LabelEditor = memo(function LabelEditor({
  labels,
  availableLabels,
  onChange,
}: LabelEditorProps) {
  const {
    search,
    setSearch,
    isOpen,
    setIsOpen,
    filteredItems: filteredAvailable,
    handleBlur,
    handleEscape,
    reset,
  } = useCombobox({
    items: availableLabels,
    selectedItems: labels,
    getItemLabel: (l) => l,
  });

  const handleRemoveLabel = useCallback(
    (labelToRemove: string) => {
      onChange(labels.filter((l) => l !== labelToRemove));
    },
    [labels, onChange]
  );

  const handleAddLabel = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (trimmed && !labels.includes(trimmed)) {
        onChange([...labels, trimmed]);
      }
      reset();
    },
    [labels, onChange, reset]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && search.trim()) {
        e.preventDefault();
        handleAddLabel(search);
      } else if (e.key === "Escape") {
        handleEscape();
      }
    },
    [search, handleAddLabel, handleEscape]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <Badge
            key={label}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {label}
            <button
              onClick={() => handleRemoveLabel(label)}
              className="ml-1 rounded-full hover:bg-gray-300 p-0.5"
              aria-label={`Remove ${label}`}
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
          placeholder="Add label..."
          className="w-full"
        />
        {isOpen && (filteredAvailable.length > 0 || search.trim()) && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
            {filteredAvailable.map((label) => (
              <button
                key={label}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddLabel(label);
                }}
              >
                {label}
              </button>
            ))}
            {search.trim() && !availableLabels.includes(search.trim()) && (
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 border-t border-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddLabel(search);
                }}
              >
                <span className="text-gray-500">Create:</span> {search.trim()}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
