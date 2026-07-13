import { ShieldCheck } from "lucide-react";

type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <span className="pv-brand" aria-label="Preuvance, accueil">
      <span className="pv-brand-mark" aria-hidden="true">
        <ShieldCheck size={compact ? 17 : 19} strokeWidth={2.2} />
      </span>
      <span className="pv-brand-name">PREUVANCE</span>
    </span>
  );
}
