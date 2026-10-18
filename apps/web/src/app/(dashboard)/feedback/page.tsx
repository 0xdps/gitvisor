"use client";

import { useState } from "react";
import { CheckmarkFilled, Send, Star, StarFilled } from "@carbon/icons-react";
import { Button, InlineLoading, InlineNotification, TextArea, Tile } from "@carbon/react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";

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
    return <InlineLoading description="Checking feedback availability" />;
  }

  if (notAvailable) {
    return <InlineNotification kind="info" title="Feedback is unavailable" subtitle="This deployment does not accept feedback." hideCloseButton lowContrast />;
  }

  if (alreadySent && !done) {
    return <InlineNotification kind="success" title="Thanks for your feedback" subtitle="You already shared feedback today. Come back tomorrow to send another response." hideCloseButton lowContrast />;
  }

  if (done) {
    return <InlineNotification kind="success" title="Feedback received" subtitle="Thank you for helping improve Gitvisor. We read every response." hideCloseButton lowContrast />;
  }

  return (
    <div style={{ maxWidth: "42rem", marginInline: "auto" }}>
      <div>
        <PageHeader
          kicker="Notes"
          title="Send feedback"
          detail="How is Gitvisor working for you?"
        />
      </div>

      <Tile style={{ marginTop: "2rem" }}>
      <form onSubmit={handleSubmit}>
        {/* Rating */}
        <fieldset>
          <legend className="cds--label-01">Rating</legend>
          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                style={{ border: 0, padding: "0.25rem", background: "transparent", color: "var(--cds-link-primary)", cursor: "pointer" }}
                aria-label={`${star} star`}
              >
                {star <= (hovered || rating) ? <StarFilled size={24} /> : <Star size={24} />}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Comment */}
        <div style={{ marginTop: "1.5rem" }}>
          <TextArea
            id="fb-comment"
            labelText="Comment"
            helperText="Optional"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="What do you love? What could be better?"
          />
        </div>

        {error && (
          <InlineNotification kind="error" title="Feedback not sent" subtitle={error} hideCloseButton lowContrast style={{ marginTop: "1rem" }} />
        )}

        <Button
          type="submit"
          disabled={submitting}
          renderIcon={submitting ? CheckmarkFilled : Send}
          style={{ marginTop: "1.5rem" }}
        >
          {submitting ? "Sending…" : "Send feedback"}
        </Button>
      </form>
      </Tile>
    </div>
  );
}
