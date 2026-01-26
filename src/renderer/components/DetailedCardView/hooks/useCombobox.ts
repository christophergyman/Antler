/**
 * useCombobox Hook
 * Shared dropdown logic for LabelEditor, AssigneeEditor, and MilestoneEditor
 */

import { useState, useMemo, useCallback } from "react";

/** Delay before closing dropdown on blur (ms) - allows click on dropdown items */
const DROPDOWN_CLOSE_DELAY = 150;

interface UseComboboxOptions<T> {
  /** All available items to choose from */
  items: T[];
  /** Currently selected items (for multi-select) or single selected item */
  selectedItems: T[];
  /** Function to get the display/search label from an item */
  getItemLabel: (item: T) => string;
}

interface UseComboboxResult<T> {
  /** Current search/filter text */
  search: string;
  /** Update search text */
  setSearch: (value: string) => void;
  /** Whether dropdown is visible */
  isOpen: boolean;
  /** Update dropdown visibility */
  setIsOpen: (value: boolean) => void;
  /** Items filtered by search, excluding already selected */
  filteredItems: T[];
  /** Handler for input blur - delays dropdown close */
  handleBlur: () => void;
  /** Handler for Escape key - closes dropdown and clears search */
  handleEscape: () => void;
  /** Reset search and close dropdown */
  reset: () => void;
}

/**
 * Shared combobox/dropdown behavior for metadata editors
 *
 * @example
 * const { search, setSearch, isOpen, setIsOpen, filteredItems, handleBlur, handleEscape, reset } =
 *   useCombobox({
 *     items: availableLabels,
 *     selectedItems: labels,
 *     getItemLabel: (l) => l,
 *   });
 */
export function useCombobox<T>({
  items,
  selectedItems,
  getItemLabel,
}: UseComboboxOptions<T>): UseComboboxResult<T> {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    return items.filter((item) => {
      const label = getItemLabel(item);
      const matchesSearch = label.toLowerCase().includes(searchLower);
      const isSelected = selectedItems.some(
        (selected) => getItemLabel(selected) === label
      );
      return matchesSearch && !isSelected;
    });
  }, [items, selectedItems, search, getItemLabel]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setIsOpen(false), DROPDOWN_CLOSE_DELAY);
  }, []);

  const handleEscape = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setIsOpen(false);
  }, []);

  return {
    search,
    setSearch,
    isOpen,
    setIsOpen,
    filteredItems,
    handleBlur,
    handleEscape,
    reset,
  };
}
