"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime, initials } from "@/lib/format";

type Comment = {
  id: string;
  body: string;
  system: boolean;
  createdAt: Date | string;
  author: {
    name: string;
    role?: { name: string } | null;
  };
};

export function CommentsThread({ requestId, comments }: { requestId: string; comments: Comment[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch(`/api/requests/${requestId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    setPending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not post comment.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="chat-thread">
      {comments.length === 0 ? (
        <div className="empty-state">No comments yet.</div>
      ) : (
        comments.map((comment) => (
          <div className="chat-message" key={comment.id}>
            <div className="avatar">{initials(comment.author.name)}</div>
            <div className={`chat-bubble ${comment.system ? "system" : ""}`}>
              <div className="chat-meta">
                <strong>{comment.author.name}</strong>
                <span>{comment.author.role?.name}</span>
                <span>{formatDateTime(comment.createdAt)}</span>
              </div>
              <p>{comment.body}</p>
            </div>
          </div>
        ))
      )}
      <form className="comment-form" onSubmit={submitComment}>
        <label className="label" htmlFor="comment-body">
          Add comment
        </label>
        <textarea
          className="input"
          id="comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          minLength={1}
          maxLength={3000}
          required
        />
        {error ? <div className="error-message">{error}</div> : null}
        <div className="button-row">
          <button className="button info" disabled={pending} type="submit">
            <Send size={16} aria-hidden="true" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
