import { type ReactNode } from "react";

interface CardFrameProps {
  chatActive: boolean;
  children: ReactNode;
  label?: string;
}

export function CardFrame({ chatActive, children, label }: CardFrameProps) {
  if (!chatActive) {
    return <>{children}</>;
  }

  return (
    <div className="card-frame">
      {label && <div className="card-frame-label">{label}</div>}
      {children}
    </div>
  );
}
