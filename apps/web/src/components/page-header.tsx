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
    <header>
      <p className="cds--label-01">{kicker}</p>
      <h1 className="cds--type-productive-heading-04" style={{ marginTop: "0.25rem" }}>
        {title}
      </h1>
      {detail ? (
        <div className="cds--type-body-01" style={{ marginTop: "0.25rem" }}>
          {detail}
        </div>
      ) : null}
    </header>
  );
}
