import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DriverSidebar } from "@/components/driver-sidebar";
import { DriverTopBar } from "@/components/driver-topbar";

interface DriverLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function DriverLayout({ children, pageTitle }: DriverLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <DriverSidebar />
        <div className="flex flex-col flex-1">
          <DriverTopBar pageTitle={pageTitle} />
          <main className="flex-1 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
