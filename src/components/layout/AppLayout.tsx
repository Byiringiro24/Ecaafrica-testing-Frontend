import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppLayout({ title, subtitle, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader title={title} subtitle={subtitle} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
