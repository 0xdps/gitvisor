"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Lock,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import {
  getBillingTrialEligibility,
  getBillingCheckout,
  claimTwitterTrial,
} from "@/lib/api-client";

// ── Context ────────────────────────────────────────────────────────────────────

interface UpgradeModalContextValue {
  openUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({
  openUpgradeModal: () => {},
});

export function useUpgradeModal() {
  return useContext(UpgradeModalContext);
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openUpgradeModal = useCallback(() => setOpen(true), []);

  return (
    <UpgradeModalContext.Provider value={{ openUpgradeModal }}>
      {children}
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
    </UpgradeModalContext.Provider>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

const PRIVATE_FEATURES = [
  "Private repositories",
  "Organization accounts",
  "All Public plan features",
];

const PUBLIC_FEATURES = [
  "Public repositories only",
  "Personal account only",
  "Workflow runs & secrets",
];

type ShareStep = "idle" | "shared";

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [shareStep, setShareStep] = useState<ShareStep>("idle");

  const { data: eligibility } = useQuery({
    queryKey: ["billing", "trial", "eligibility"],
    queryFn: getBillingTrialEligibility,
    retry: false,
    // Don't block render if billing routes aren't available (core deployments)
    throwOnError: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      getBillingCheckout("private", window.location.href).then(({ url }) => {
        window.location.href = url;
      }),
  });

  const trialMutation = useMutation({
    mutationFn: () => claimTwitterTrial(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["repositories"] });
      void queryClient.invalidateQueries({ queryKey: ["installations"] });
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      onClose();
    },
  });

  function handleShare() {
    const text = encodeURIComponent(
      "I'm using @gitvisor to track my GitHub workflows, secrets, and packages — highly recommend it 🚀 https://gitvisor.app",
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
    setShareStep("shared");
  }

  const canClaimTrial = eligibility?.eligible !== false;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-blue" />
              <h2 id="upgrade-modal-title" className="text-base font-semibold">
                Upgrade to Private
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Unlock private repositories and organization accounts.
            </p>
          </div>

          {/* Plan comparison */}
          <div className="grid grid-cols-2 gap-3 px-6 py-4">
            {/* Public plan */}
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Public
              </div>
              <div className="text-2xl font-bold mb-3">$0</div>
              <ul className="space-y-2">
                {PUBLIC_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Private plan */}
            <div className="rounded-xl border border-blue/30 bg-blue/5 p-4 relative">
              <div className="absolute -top-px left-4 right-4 h-px bg-blue/50 rounded-full" />
              <div className="text-xs font-semibold text-blue uppercase tracking-wider mb-1">
                Private
              </div>
              <div className="text-2xl font-bold mb-3">$2.49<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="space-y-2">
                {PRIVATE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="h-3 w-3 text-blue shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTAs */}
          <div className="px-6 pb-6 space-y-3">
            {/* Upgrade button */}
            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="w-full rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue/90 disabled:opacity-50 transition-colors"
            >
              {checkoutMutation.isPending ? "Redirecting…" : "Upgrade to Private — $2.49/mo"}
            </button>

            {/* Twitter trial */}
            {canClaimTrial && (
              <div className="rounded-xl border border-border bg-background/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <p className="text-xs font-medium">
                    Share on X and get <span className="text-amber-400">15 days free</span>
                  </p>
                </div>

                {shareStep === "idle" ? (
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share on X
                  </button>
                ) : (
                  <button
                    onClick={() => trialMutation.mutate()}
                    disabled={trialMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {trialMutation.isPending ? "Claiming…" : "I shared it! Claim 15 days free"}
                  </button>
                )}

                {trialMutation.isError && (
                  <p className="text-xs text-destructive text-center">
                    Could not claim trial. Please try again.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
