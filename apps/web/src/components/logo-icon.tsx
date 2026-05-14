interface LogoIconProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: { wrapper: "h-5 w-5 rounded",      img: "h-5 w-5" },
  sm: { wrapper: "h-6 w-6 rounded-md",   img: "h-6 w-6" },
  md: { wrapper: "h-8 w-8 rounded-lg",   img: "h-8 w-8" },
  lg: { wrapper: "h-10 w-10 rounded-xl", img: "h-10 w-10" },
  xl: { wrapper: "h-14 w-14 rounded-2xl", img: "h-14 w-14" },
} as const;

/**
 * Renders the Gitvisor icon on a white background so the git-branch
 * logo inside the visor is clearly visible against dark page backgrounds.
 */
export function LogoIcon({ size = "md", className }: LogoIconProps) {
  const s = sizes[size];
  return (
    <div
      className={`${s.wrapper} bg-white shrink-0 overflow-hidden ${className ?? ""}`}
    >
      <img
        src="/icon-trans.png"
        alt="Gitvisor"
        className={`${s.img} object-cover`}
      />
    </div>
  );
}
