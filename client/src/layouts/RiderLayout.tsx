import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RiderSidebar } from "@/components/rider-sidebar";
import { RiderTopBar } from "@/components/rider-topbar";

interface RiderLayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export function RiderLayout({ children, pageTitle }: RiderLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <RiderSidebar />
        <div className="flex flex-col flex-1">
          <RiderTopBar pageTitle={pageTitle} />
          <main className="flex-1 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
