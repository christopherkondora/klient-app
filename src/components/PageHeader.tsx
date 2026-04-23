import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 border-b border-teal/10 pb-5 md:flex-row md:items-start md:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        <h1 className="font-pixel text-[1.45rem] leading-none text-cream md:text-[1.65rem]">{title}</h1>
        {subtitle && (
          <div className="text-muted mt-2 text-sm leading-6 md:max-w-2xl">
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}