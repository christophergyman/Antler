/**
 * AddCommentForm Component
 * Input form for adding new comments to an issue
 */

import { memo, useState, useCallback } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import type { AddCommentFormProps } from "./types";

export const AddCommentForm = memo(function AddCommentForm({
  onSubmit,
  isSubmitting,
}: AddCommentFormProps) {
  const [comment, setComment] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!comment.trim()) return;
    const success = await onSubmit(comment.trim());
    if (success) {
      setComment("");
    }
  }, [comment, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter to submit
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="space-y-2 pt-3 border-t border-gray-200">
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment... (Cmd+Enter to submit)"
        className="w-full min-h-[80px] resize-y"
        disabled={isSubmitting}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!comment.trim() || isSubmitting}
          size="sm"
        >
          {isSubmitting ? "Posting..." : "Comment"}
        </Button>
      </div>
    </div>
  );
});
