"use client";

import { useQuery } from "@tanstack/react-query";
import { Add, CheckmarkFilled, Locked, Renew } from "@carbon/icons-react";
import {
  Button,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
  Tile,
} from "@carbon/react";
import { getInstallations } from "@/lib/api-client";
import { useUpgradeModal } from "./upgrade-modal";

export function InstallAccountsPanel() {
  const { data: installations = [], isLoading, refetch } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const { openUpgradeModal } = useUpgradeModal();

  const baseInstallUrl =
    installations.find((a) => a.installUrl)?.installUrl?.replace(
      /\/installations\/new\/permissions.*$/,
      "/installations/new",
    ) ?? null;

  const allInstalled = installations.length > 0 && installations.every((a) => a.installed);

  if (isLoading) {
    return (
      <Tile>
        <SkeletonText heading width="35%" />
        <SkeletonText paragraph lineCount={3} width="70%" />
      </Tile>
    );
  }

  if (installations.length === 0) return null;

  return (
    <Tile style={{ padding: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1rem",
          borderBottom: "1px solid var(--cds-border-subtle-01)",
        }}
      >
        <div>
          <h3 className="cds--type-productive-heading-02">Connect GitHub App</h3>
          <p className="cds--helper-text" style={{ marginTop: "0.25rem" }}>
            {allInstalled
              ? "All accounts connected"
              : "Install the app on each account to start tracking."}
          </p>
        </div>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Renew}
          iconDescription="Refresh connected accounts"
          onClick={() => void refetch()}
        />
      </div>

      <StructuredListWrapper isCondensed>
        <StructuredListBody>
          {installations.map((account) => (
            <StructuredListRow key={account.login}>
              <StructuredListCell>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.avatarUrl}
                  alt={account.login}
                      width={32}
                      height={32}
                      style={{ borderRadius: "50%", opacity: account.locked ? 0.4 : 1 }}
                />
              ) : (
                    <span
                      className="cds--type-label-01"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: "var(--cds-layer-02)",
                      }}
                    >
                  {account.login.slice(0, 1).toUpperCase()}
                    </span>
              )}
                  <span>
                    <span className="cds--type-body-compact-01" style={{ display: "block" }}>
                      {account.login}
                    </span>
                    <span className="cds--helper-text">{account.type}</span>
                  </span>
              </div>
              </StructuredListCell>
              <StructuredListCell noWrap>
            {account.locked ? (
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Locked}
                onClick={openUpgradeModal}
              >
                    Upgrade
                  </Button>
            ) : account.installed ? (
                  <Tag type="green" renderIcon={CheckmarkFilled}>Connected</Tag>
            ) : (
                  <Button
                    as="a"
                href={account.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                    size="sm"
              >
                Install App
                  </Button>
            )}
              </StructuredListCell>
            </StructuredListRow>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>

      {baseInstallUrl && (
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--cds-border-subtle-01)" }}>
          <Button
            as="a"
            href={baseInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            kind="ghost"
            size="sm"
            renderIcon={Add}
          >
            Install on another organization
          </Button>
        </div>
      )}
    </Tile>
  );
}
