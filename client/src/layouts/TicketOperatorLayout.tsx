import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Ticket, 
  Car, 
  CalendarCheck, 
  Wallet, 
  User, 
  ChevronLeft,
  Settings,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface TicketOperatorLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { 
    path: "/ticket-operator/dashboard", 
    label: "ড্যাশবোর্ড", 
    icon: LayoutDashboard,
    testId: "nav-dashboard"
  },
  { 
    path: "/ticket-operator/tickets", 
    label: "টিকিট", 
    icon: Ticket,
    testId: "nav-tickets"
  },
  { 
    path: "/ticket-operator/rentals", 
    label: "রেন্টাল", 
    icon: Car,
    testId: "nav-rentals"
  },
  { 
    path: "/ticket-operator/bookings", 
    label: "বুকিং", 
    icon: CalendarCheck,
    testId: "nav-bookings"
  },
  { 
    path: "/ticket-operator/wallet", 
    label: "ওয়ালেট", 
    icon: Wallet,
    testId: "nav-wallet"
  },
  { 
    path: "/ticket-operator/profile", 
    label: "প্রোফাইল", 
    icon: User,
    testId: "nav-profile"
  },
];

export function TicketOperatorLayout({ children }: TicketOperatorLayoutProps) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold" data-testid="text-header-title">
              টিকিট ও রেন্টাল অপারেটর
            </h1>
            <p className="text-xs text-muted-foreground">SafeGo Bangladesh</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden md:flex w-64 flex-col border-r bg-card min-h-[calc(100vh-3.5rem)]">
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = location === item.path || 
                (item.path !== "/ticket-operator/dashboard" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-12 text-base",
                      isActive && "font-bold"
                    )}
                    data-testid={item.testId}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 md:hidden border-t bg-card z-50">
          <div className="flex justify-around py-2">
            {menuItems.slice(0, 5).map((item) => {
              const isActive = location === item.path || 
                (item.path !== "/ticket-operator/dashboard" && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex-col h-auto py-2 px-3 gap-1",
                      isActive && "text-primary"
                    )}
                    data-testid={`mobile-${item.testId}`}
                  >
                    <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    <span className="text-xs">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
