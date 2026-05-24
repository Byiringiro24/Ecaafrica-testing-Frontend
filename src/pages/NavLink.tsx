import { Link, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  to: string;
  end?: boolean;
  className?: string | ((props: { isActive: boolean }) => string);
  activeClassName?: string;
  onClick?: () => void;
  children: ReactNode | ((props: { isActive: boolean }) => ReactNode);
}

export function NavLink({ to, end = false, className, activeClassName, onClick, children }: NavLinkProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const resolvedClass =
    typeof className === "function"
      ? className({ isActive })
      : cn(className, isActive && activeClassName);

  const resolvedChildren =
    typeof children === "function" ? children({ isActive }) : children;

  return (
    <Link to={to} className={resolvedClass} onClick={onClick}>
      {resolvedChildren}
    </Link>
  );
}
