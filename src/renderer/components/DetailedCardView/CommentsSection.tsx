/**
 * CommentsSection Component
 * Display existing comments and form to add new ones
 */

import { memo } from "react";
import { AddCommentForm } from "./AddCommentForm";
import type { CommentsSectionProps } from "./types";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const CommentsSection = memo(function CommentsSection({
  comments,
  onAddComment,
  isAddingComment,
}: CommentsSectionProps) {
  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No comments yet</div>
      ) : (
        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 rounded-lg p-3 space-y-1"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-900">
                  {comment.author}
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 text-xs">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.body}
              </div>
            </div>
          ))}
        </div>
      )}
      <AddCommentForm onSubmit={onAddComment} isSubmitting={isAddingComment} />
    </div>
  );
});
