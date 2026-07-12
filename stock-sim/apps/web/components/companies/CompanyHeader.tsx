import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPct, formatPrice, trendColorClass } from "@/lib/utils";
import type { CompanyDetail } from "@/lib/api/types";

export interface CompanyHeaderProps {
  company: CompanyDetail;
  dayChangePct: number | null;
}

export function CompanyHeader({ company, dayChangePct }: CompanyHeaderProps) {
  const trend = trendColorClass(dayChangePct);
  const ivGap =
    company.latest_iv && Number(company.latest_iv) > 0 && company.latest_price
      ? ((Number(company.latest_price) - Number(company.latest_iv)) / Number(company.latest_iv)) * 100
      : null;

  return (
    <div className="flex items-center gap-4 h-12 mb-4">
      <span className="num text-h2 font-bold text-text-primary">{company.ticker}</span>
      <span className="text-base text-text-secondary truncate max-w-[280px]">{company.name}</span>
      <Badge>{company.industry_name}</Badge>
      <div className="flex-1" />
      <span className="num text-h2 font-bold text-text-primary">{formatPrice(company.latest_price ? Number(company.latest_price) : null)}</span>
      <span className={`num text-base flex items-center gap-1 ${trend}`}>
        {dayChangePct != null && (dayChangePct >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
        {formatPct(dayChangePct)}
      </span>
      {ivGap != null && <span className="num text-small text-text-secondary">IV gap {formatPct(ivGap)}</span>}
    </div>
  );
}
