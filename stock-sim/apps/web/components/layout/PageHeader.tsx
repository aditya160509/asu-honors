import type { ComponentType } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: ComponentType<{ className?: string }>;
}

/** Shared title block for TERMINAL pages — consistent hierarchy/spacing across the app. */
export function PageHeader({ title, description, actions, icon: Icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-1 h-5 w-5 text-text-secondary" />}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h2 font-semibold text-text-primary">{title}</h1>
        {description && <p className="text-small text-text-secondary">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 pt-0.5">{actions}</div>}
    </div>
  );
}
