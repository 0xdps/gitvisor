interface LogoIconProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const pixels = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
} as const;

export function LogoIcon({ size = "md", className }: LogoIconProps) {
  const px = pixels[size];
  return (
    <img
      src="/icon-192x192.png"
      alt=""
      width={px}
      height={px}
      className={className}
      style={{ width: px, height: px, display: "block", flexShrink: 0 }}
    />
  );
}
