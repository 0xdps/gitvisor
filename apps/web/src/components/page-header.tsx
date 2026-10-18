export function PageHeader({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail?: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{kicker}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {detail ? <div className="mt-1 text-sm text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
