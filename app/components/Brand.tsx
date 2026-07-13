type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <span
      className={`pv-brand${compact ? " is-compact" : ""}`}
      role="img"
      aria-label="Preuvance"
    >
      <span className="pv-brand-name" aria-hidden="true">
        <span>PR</span>
        <span className="pv-brand-e">
          <span className="pv-brand-e-bar" />
          <span className="pv-brand-e-bar" />
          <span className="pv-brand-e-bar" />
        </span>
        <span>UVANCE</span>
      </span>
    </span>
  );
}
