"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Add,
  Analytics,
  Catalog,
  Chat,
  Code,
  Dashboard,
  Document,
  Flow,
  Launch,
  Locked,
  Logout,
  Menu,
  Package,
  Password,
  Tag as TagIcon,
  Upgrade,
  UserAvatar,
} from "@carbon/icons-react";
import {
  Button,
  Content,
  Dropdown,
  Header,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SkeletonText,
  SkipToContent,
  Tag,
} from "@carbon/react";
import { LogoIcon } from "./logo-icon";
import { me, logout as authLogout } from "../lib/auth-client";
import {
  getBillingSubscription,
  getInstallations,
  getWorkflowRuns,
  type AccountInstallation,
} from "../lib/api-client";
import { useAccount } from "../lib/account-context";
import { useUpgradeModal } from "./upgrade-modal";

interface AppShellProps {
  children: ReactNode;
}

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType;
};

const navGroups: NavItem[][] = [
  [{ label: "Attention", to: "/dashboard", icon: Dashboard }],
  [
    { label: "Workflows", to: "/workflows", icon: Flow },
    { label: "Pull requests", to: "/pull-requests", icon: Code },
    { label: "Releases", to: "/releases", icon: TagIcon },
    { label: "Packages", to: "/packages", icon: Package },
  ],
  [
    { label: "Repositories", to: "/repositories", icon: Catalog },
    { label: "Secrets", to: "/secrets", icon: Password },
  ],
  [
    { label: "Analytics", to: "/analytics", icon: Analytics },
    { label: "Audit log", to: "/audit-log", icon: Document },
    { label: "Feedback", to: "/feedback", icon: Chat },
  ],
];

type AccountOption =
  | { id: "all"; kind: "all"; text: string }
  | { id: string; kind: "account" | "locked" | "install"; text: string; account: AccountInstallation };

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 66rem)");
    const sync = () => {
      setIsDesktop(desktop.matches);
      if (!desktop.matches) return;
      const collapsed = localStorage.getItem("sidebar-expanded") === "false";
      setExpanded(!collapsed);
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  function toggleNav() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-expanded", String(next));
      return next;
    });
  }

  const { selected: selectedAccount, select: selectAccount } = useAccount();
  const { openUpgradeModal } = useUpgradeModal();

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: installations, isLoading: installationsLoading } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
    retry: false,
  });

  const { data: subscription, isError: billingUnavailable } = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: getBillingSubscription,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!selectedAccount || !installations) return;
    const match = installations.find(
      (a) => a.login.toLowerCase() === selectedAccount.login.toLowerCase(),
    );
    if (match?.locked) selectAccount(null);
  }, [installations, selectedAccount, selectAccount]);

  const { data: liveRuns } = useQuery({
    queryKey: ["workflows", "live"],
    queryFn: () => getWorkflowRuns({ status: "in_progress", perPage: 1 }),
    staleTime: 15_000,
    retry: false,
  });

  const liveCount = liveRuns?.total ?? 0;

  function handleLogout() {
    void authLogout().then(() => {
      window.location.href = "/login";
    });
  }

  const allAccountsOption: AccountOption = { id: "all", kind: "all", text: "All accounts" };
  const accountOptions: AccountOption[] = [
    allAccountsOption,
    ...(installations ?? [])
      .filter((a) => a.installed || a.installUrl || a.locked)
      .map((account): AccountOption => ({
        id: account.login,
        kind: account.locked ? "locked" : account.installed ? "account" : "install",
        text: account.login,
        account,
      })),
  ];
  const selectedOption =
    accountOptions.find((o) => o.kind === "account" && o.id === selectedAccount?.login) ?? allAccountsOption;

  function handleAccountChange(option: AccountOption | null | undefined) {
    if (!option) return;
    if (option.kind === "all") selectAccount(null);
    else if (option.kind === "account") selectAccount(option.account);
    else if (option.kind === "locked") openUpgradeModal();
    else window.open(option.account.installUrl, "_blank", "noopener,noreferrer");
  }

  const installUrl = installations?.find((a) => !a.installed && a.installUrl)?.installUrl;
  const onTrial = subscription?.status === "trialing" || Boolean(subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date());
  const onPrivatePlan = subscription?.planId === "private" || onTrial;

  return (
    <>
      <Header aria-label="Gitvisor">
        <SkipToContent href="#main" />
        <HeaderMenuButton
          aria-label={expanded ? "Close menu" : "Open menu"}
          isCollapsible
          onClick={toggleNav}
          isActive={expanded}
          {...(isDesktop ? { renderCloseIcon: <Menu size={20} /> } : {})}
        />
        <HeaderName href="/dashboard" prefix="" as={Link}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <LogoIcon size="xs" />
            Gitvisor
          </span>
        </HeaderName>
      </Header>
      <SideNav
        aria-label="Gitvisor"
        expanded={expanded}
        isChildOfHeader={false}
        isPersistent={false}
        className="gitvisor-sidenav"
      >
        <div className="gitvisor-sidenav__workspace">
          {installationsLoading ? (
            <SkeletonText heading width="80%" />
          ) : (
            <Dropdown<AccountOption>
              id="gitvisor-account"
              titleText="Workspace"
              label="All accounts"
              size="md"
              items={accountOptions}
              selectedItem={selectedOption}
              itemToString={(item) => item?.text ?? ""}
              itemToElement={(item) => (
                <span className="gitvisor-sidenav__account-option">
                  <span className="gitvisor-sidenav__account-name">{item.text}</span>
                  {item.kind === "locked" ? (
                    <Locked size={16} aria-label="Requires Private plan" />
                  ) : item.kind === "install" ? (
                    <Add size={16} aria-label="Install Gitvisor" />
                  ) : null}
                </span>
              )}
              onChange={({ selectedItem }) => handleAccountChange(selectedItem)}
            />
          )}

          <div className="gitvisor-sidenav__plan">
            {billingUnavailable ? null : !subscription ? (
              <SkeletonText width="60%" />
            ) : (
              <>
                <div className="gitvisor-sidenav__plan-row">
                  <span className="cds--label-01">Plan</span>
                  <Tag size="sm" type={onPrivatePlan ? "blue" : "gray"}>
                    {onTrial ? "Private trial" : onPrivatePlan ? "Private" : "Public"}
                  </Tag>
                </div>
                {!onPrivatePlan ? (
                  <Button kind="tertiary" size="sm" renderIcon={Upgrade} onClick={openUpgradeModal}>
                    Unlock private repos
                  </Button>
                ) : null}
              </>
            )}
            {installUrl ? (
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Launch}
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Install on another account
              </Button>
            ) : null}
          </div>
        </div>

        <SideNavItems className="gitvisor-sidenav__items">
          {navGroups.flatMap((group, groupIndex) => {
            const links = group.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <SideNavLink
                  key={item.to}
                  as={Link}
                  href={item.to}
                  isActive={isActive}
                  renderIcon={item.icon}
                >
                  {item.label}
                  {item.to === "/workflows" && liveCount > 0 ? (
                    <Tag size="sm" type="blue">
                      {liveCount > 9 ? "9+" : liveCount}
                    </Tag>
                  ) : null}
                </SideNavLink>
              );
            });
            return groupIndex === 0
              ? links
              : [<SideNavDivider key={`divider-${groupIndex}`} />, ...links];
          })}
        </SideNavItems>

        <div className="gitvisor-sidenav__profile">
          <Link href="/profile" className="gitvisor-sidenav__profile-link" aria-current={pathname === "/profile" ? "page" : undefined}>
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="gitvisor-sidenav__avatar" />
            ) : (
              <UserAvatar size={32} />
            )}
            <span className="gitvisor-sidenav__identity">
              <span className="cds--type-body-compact-01">{user?.name ?? user?.githubUsername ?? "Profile"}</span>
              {user?.githubUsername ? <span className="cds--helper-text">@{user.githubUsername}</span> : null}
            </span>
          </Link>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Logout}
            iconDescription="Sign out"
            tooltipPosition="top"
            tooltipAlignment="end"
            onClick={handleLogout}
          />
        </div>
      </SideNav>
      <Content id="main" className="gitvisor-dashboard">
        {children}
      </Content>
    </>
  );
}
