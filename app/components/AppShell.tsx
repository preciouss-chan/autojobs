import Link from "next/link";
import type { ReactNode } from "react";

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps): React.ReactElement {
  return (
    <div className="app-frame">
      <div className="app-shell">{children}</div>
    </div>
  );
}

interface PageAction {
  readonly href: string;
  readonly label: string;
  readonly tone?: "primary" | "secondary" | "subtle";
}

interface PageHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actions?: readonly PageAction[];
  readonly meta?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: PageHeaderProps): React.ReactElement {
  return (
    <header className="app-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="eyebrow">{eyebrow}</p>
          <div className="space-y-3">
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">{description}</p>
          </div>
        </div>

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={joinClassNames(
                  action.tone === "primary"
                    ? "action-primary"
                    : action.tone === "subtle"
                      ? "action-subtle"
                      : "action-secondary"
                )}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {meta ? <div className="flex flex-wrap gap-3">{meta}</div> : null}
    </header>
  );
}

interface SurfacePanelProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly muted?: boolean;
}

export function SurfacePanel({
  children,
  className,
  muted = false,
}: SurfacePanelProps): React.ReactElement {
  return (
    <section
      className={joinClassNames(
        "surface-panel",
        muted && "surface-panel-muted",
        className
      )}
    >
      {children}
    </section>
  );
}

interface SurfaceHeadingProps {
  readonly title: string;
  readonly description?: string;
  readonly aside?: ReactNode;
}

export function SurfaceHeading({
  title,
  description,
  aside,
}: SurfaceHeadingProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-copy">{description}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  );
}
