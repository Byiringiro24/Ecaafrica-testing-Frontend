import { ReactNode, useEffect, useState } from "react";
import { SuspendedBanner } from "@/components/layout/SuspendedBanner";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import {
  getSchoolAuth,
  isDirectorOfDisciplineRole,
  isDirectorOfStudiesRole,
  isSchoolAdminRole,
  roleHome,
} from "@/lib/schoolAuth";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  allowDirectorOfDiscipline?: boolean;
}

export function AppLayout({ title, subtitle, children, allowDirectorOfDiscipline = false }: Props) {
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = getSchoolAuth();
    if (!auth?.accessToken) {
      window.location.replace("/login");
      setIsAuthed(false);
      return;
    }

    const canAccess =
      isSchoolAdminRole() ||
      isDirectorOfStudiesRole() ||
      (allowDirectorOfDiscipline && isDirectorOfDisciplineRole());

    if (!canAccess) {
      window.location.replace(roleHome(auth.user?.role));
      setIsAuthed(false);
      return;
    }

    setIsAuthed(true);
  }, [allowDirectorOfDiscipline]);

  if (isAuthed !== true) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader title={title} subtitle={subtitle} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 px-4 md:px-8 py-6"><SuspendedBanner />{children}</main>
      </div>
    </div>
  );
}

