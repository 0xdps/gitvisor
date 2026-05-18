"use client";

import { useState, useEffect } from "react";
import { Star, Send, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export default function FeedbackPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["feedback-status"],
    queryFn: () => apiFetch<{ canSubmit: boolean }>("/feedback/status").catch(() => null),
    staleTime: 60_000,
    retry: false,
  });

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback not available in this deployment (core-only / 404)
  const notAvailable = !statusLoading && status === null;
  const alreadySent = !statusLoading && status != null && !status.canSubmit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/feedback", {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg.includes("rate_limited") ? "You've already submitted feedback today." : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="size-5 rounded-full border-2 border-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notAvailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <p className="text-muted-foreground text-sm">Feedback is not available in this deployment.</p>
      </div>
    );
  }

  if (alreadySent && !done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <CheckCircle2 className="size-12 text-blue" />
        <h2 className="text-xl font-semibold text-foreground">Thanks for your feedback!</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          You've already shared feedback today. Come back tomorrow — we'd love to hear from you again.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <CheckCircle2 className="size-12 text-blue" />
        <h2 className="text-xl font-semibold text-foreground">Feedback received!</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Thank you for helping us improve Gitvisor. We read every response.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Send Feedback</h1>
        <p className="text-muted-foreground text-sm mt-1">
          How's Gitvisor working for you? Tell us what you think.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="p-0.5 rounded transition-transform hover:scale-110 focus:outline-none"
                aria-label={`${star} star`}
              >
                <Star
                  className={`size-7 transition-colors ${
                    star <= (hovered || rating)
                      ? "fill-blue text-blue"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="fb-comment">
            Comment <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="fb-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue/50 resize-none"
            placeholder="What do you love? What could be better?"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-md bg-blue px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="size-4" />
          {submitting ? "Sending…" : "Send Feedback"}
        </button>
      </form>
    </div>
  );
}
