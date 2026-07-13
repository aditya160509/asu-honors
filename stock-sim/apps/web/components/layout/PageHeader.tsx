export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Shared title block for TERMINAL pages — consistent hierarchy/spacing across the app. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-h2 font-semibold text-text-primary">{title}</h1>
        {description && <p className="text-small text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 pt-0.5">{actions}</div>}
    </div>
  );
}
