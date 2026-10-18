"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkmark, Locked, LogoX } from "@carbon/icons-react";
import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tag,
  Tile,
} from "@carbon/react";
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
      <UpgradeModal open={open} onClose={() => setOpen(false)} />
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

function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <ComposedModal open={open} onClose={onClose} size="md">
      <ModalHeader
        buttonOnClick={onClose}
        closeModal={onClose}
        label="Plans"
        title="Upgrade to Private"
      />
      <ModalBody hasScrollingContent>
        <p className="cds--type-body-01">
          Unlock private repositories and organization accounts.
        </p>
        <div className="gitvisor-plan-comparison">
          {[
            { name: "Public", price: "$0", features: PUBLIC_FEATURES, highlighted: false },
            { name: "Private", price: "$2.49/mo", features: PRIVATE_FEATURES, highlighted: true },
          ].map((plan) => (
            <Tile
              key={plan.name}
              style={{
                height: "100%",
                borderTop: plan.highlighted ? "3px solid var(--cds-interactive)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className="cds--type-productive-heading-02">{plan.name}</h3>
                {plan.highlighted ? <Tag type="blue">Recommended</Tag> : null}
              </div>
              <p className="cds--type-productive-heading-04" style={{ marginTop: "1rem" }}>
                {plan.price}
              </p>
              <ul style={{ marginTop: "1.5rem" }}>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="cds--type-body-compact-01"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}
                  >
                    <Checkmark size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
            </Tile>
          ))}
        </div>
        {canClaimTrial ? (
          <Tile style={{ marginTop: "1rem" }}>
            <Tag type="purple">15 days free</Tag>
            <h3 className="cds--type-productive-heading-02" style={{ marginTop: "0.75rem" }}>
              Share Gitvisor on X
            </h3>
            <p className="cds--type-body-01" style={{ marginTop: "0.5rem" }}>
              Open a prefilled post, then return here to claim the trial.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
              {shareStep === "idle" ? (
                <Button kind="tertiary" renderIcon={LogoX} onClick={handleShare}>
                  Share on X
                </Button>
              ) : (
                <Button
                  kind="tertiary"
                  renderIcon={Checkmark}
                  disabled={trialMutation.isPending}
                  onClick={() => trialMutation.mutate()}
                >
                  {trialMutation.isPending ? "Claiming…" : "Claim 15 days free"}
                </Button>
              )}
            </div>
            {trialMutation.isError ? (
              <InlineNotification
                kind="error"
                title="Trial not claimed"
                subtitle="Try again in a moment."
                hideCloseButton
                lowContrast
                style={{ marginTop: "1rem" }}
              />
            ) : null}
          </Tile>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Stay on Public
        </Button>
        <Button
          renderIcon={Locked}
          disabled={checkoutMutation.isPending}
          onClick={() => checkoutMutation.mutate()}
        >
          {checkoutMutation.isPending ? "Opening checkout…" : "Upgrade · $2.49/month"}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
