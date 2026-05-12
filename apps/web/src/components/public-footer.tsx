import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold">
              <GitBranch className="h-4 w-4" />
              <span>Gitvisor</span>
            </div>
            <p className="text-sm text-muted-foreground">
              GitHub Actions visibility for developers who ship.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/#features" className="transition-colors hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/0xdps/gitvisor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  Open source
                </a>
              </li>
              <li>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/privacy" className="transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/tos" className="transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {year} Gitvisor. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
