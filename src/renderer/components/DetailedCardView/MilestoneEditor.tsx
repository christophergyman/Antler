/**
 * MilestoneEditor Component
 * Dropdown selector for milestone with ability to create new
 */

import { memo, useState, useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useCombobox } from "./hooks";
import type { MilestoneEditorProps } from "./types";

export const MilestoneEditor = memo(function MilestoneEditor({
  milestone,
  availableMilestones,
  onChange,
  onCreateNew,
}: MilestoneEditorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // For milestone (single-select), we don't exclude current selection from dropdown
  const emptySelection = useMemo(() => [] as string[], []);

  const {
    search,
    setSearch,
    isOpen,
    setIsOpen,
    handleBlur,
    handleEscape,
    reset,
  } = useCombobox({
    items: availableMilestones,
    selectedItems: emptySelection,
    getItemLabel: (m) => m,
  });

  // Filter milestones manually since we want to show all (including current)
  const filteredMilestones = useMemo(() =>
    availableMilestones.filter((m) =>
      m.toLowerCase().includes(search.toLowerCase())
    ),
    [availableMilestones, search]
  );

  const handleSelect = useCallback(
    (selected: string | null) => {
      onChange(selected);
      reset();
    },
    [onChange, reset]
  );

  const handleCreateNew = useCallback(async () => {
    if (!search.trim()) return;
    setIsCreating(true);
    const success = await onCreateNew(search.trim());
    setIsCreating(false);
    if (success) {
      onChange(search.trim());
      reset();
    }
  }, [search, onCreateNew, onChange, reset]);

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
      {milestone && (
        <div className="flex items-center gap-2">
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{milestone}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(null)}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Remove
          </Button>
        </div>
      )}
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
          placeholder={milestone ? "Change milestone..." : "Set milestone..."}
          className="w-full"
        />
        {isOpen && (filteredMilestones.length > 0 || search.trim()) && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
            {filteredMilestones.map((m) => (
              <button
                key={m}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(m);
                }}
              >
                {m}
              </button>
            ))}
            {search.trim() && !availableMilestones.includes(search.trim()) && (
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 border-t border-gray-100 flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateNew();
                }}
                disabled={isCreating}
              >
                {isCreating ? (
                  <span className="text-gray-400">Creating...</span>
                ) : (
                  <>
                    <span className="text-gray-500">Create:</span> {search.trim()}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
