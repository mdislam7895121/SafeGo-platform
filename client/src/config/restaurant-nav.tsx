import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Tag,
  Wallet,
  TrendingUp,
  Star,
  Settings,
  FileText,
  HelpCircle,
  Clock,
  Calendar,
  History,
  Grid,
  FolderPlus,
  PlusCircle,
  Megaphone,
  Percent,
  Sparkles,
  DollarSign,
  CreditCard,
  Building,
  BarChart3,
  PieChart,
  Activity,
  MessageSquare,
  AlertTriangle,
  Store,
  MapPin,
  Users,
  Printer,
  Shield,
  Award,
  LifeBuoy,
  Phone,
  Gauge
} from "lucide-react";

export type UserRole = "OWNER" | "STAFF";

export interface NavItem {
  label: string;
  icon: any;
  path?: string;
  section?: string;
  requiredRole?: UserRole[];
  children?: NavItem[];
}

export const restaurantNavigation: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/restaurant/dashboard",
    section: "main"
  },
  {
    label: "Orders",
    icon: ShoppingBag,
    section: "main",
    children: [
      {
        label: "Live Orders",
        icon: Clock,
        path: "/restaurant/orders/live"
      },
      {
        label: "Scheduled Orders",
        icon: Calendar,
        path: "/restaurant/orders/scheduled"
      },
      {
        label: "Order History",
        icon: History,
        path: "/restaurant/orders/history"
      }
    ]
  },
  {
    label: "Menu Management",
    icon: UtensilsCrossed,
    section: "main",
    children: [
      {
        label: "All Items",
        icon: Grid,
        path: "/restaurant/menu/items"
      },
      {
        label: "Categories",
        icon: FolderPlus,
        path: "/restaurant/menu/categories"
      },
      {
        label: "Add New Item",
        icon: PlusCircle,
        path: "/restaurant/menu/new"
      }
    ]
  },
  {
    label: "Promotions",
    icon: Tag,
    section: "marketing",
    children: [
      {
        label: "Campaigns",
        icon: Megaphone,
        path: "/restaurant/promotions/campaigns"
      },
      {
        label: "Coupons & Discounts",
        icon: Percent,
        path: "/restaurant/promotions/coupons"
      },
      {
        label: "Featured Items",
        icon: Sparkles,
        path: "/restaurant/promotions/featured"
      }
    ]
  },
  {
    label: "Payouts & Finance",
    icon: Wallet,
    section: "finance",
    children: [
      {
        label: "Earnings Overview",
        icon: DollarSign,
        path: "/restaurant/payouts/overview"
      },
      {
        label: "Payout History",
        icon: History,
        path: "/restaurant/payouts/history"
      },
      {
        label: "Bank & Tax Info",
        icon: Building,
        path: "/restaurant/payouts/bank-info",
        requiredRole: ["OWNER"]
      }
    ]
  },
  {
    label: "Insights & Analytics",
    icon: TrendingUp,
    section: "analytics",
    children: [
      {
        label: "Sales Analytics",
        icon: BarChart3,
        path: "/restaurant/analytics/sales"
      },
      {
        label: "Order Performance",
        icon: PieChart,
        path: "/restaurant/analytics/orders"
      },
      {
        label: "Menu Performance",
        icon: Activity,
        path: "/restaurant/analytics/menu"
      }
    ]
  },
  {
    label: "Ratings & Reviews",
    icon: Star,
    section: "feedback",
    children: [
      {
        label: "All Reviews",
        icon: MessageSquare,
        path: "/restaurant/reviews"
      },
      {
        label: "Complaints / Issues",
        icon: AlertTriangle,
        path: "/restaurant/reviews/complaints"
      }
    ]
  },
  {
    label: "Store Settings",
    icon: Settings,
    section: "settings",
    children: [
      {
        label: "Store Profile",
        icon: Store,
        path: "/restaurant/settings/profile"
      },
      {
        label: "Business Hours",
        icon: Clock,
        path: "/restaurant/settings/hours"
      },
      {
        label: "Delivery & Pickup Rules",
        icon: MapPin,
        path: "/restaurant/settings/delivery"
      },
      {
        label: "Staff & Roles",
        icon: Users,
        path: "/restaurant/settings/staff",
        requiredRole: ["OWNER"]
      },
      {
        label: "Devices & Printers",
        icon: Printer,
        path: "/restaurant/settings/devices"
      }
    ]
  },
  {
    label: "Documents & Compliance",
    icon: FileText,
    section: "compliance",
    requiredRole: ["OWNER"],
    children: [
      {
        label: "Business Documents",
        icon: FileText,
        path: "/restaurant/documents/business"
      },
      {
        label: "Health & Safety",
        icon: Shield,
        path: "/restaurant/documents/health"
      },
      {
        label: "KYC / Verification",
        icon: Award,
        path: "/restaurant/documents/kyc"
      }
    ]
  },
  {
    label: "Support",
    icon: HelpCircle,
    section: "support",
    children: [
      {
        label: "Help Center",
        icon: LifeBuoy,
        path: "/restaurant/support/help"
      },
      {
        label: "Contact Support",
        icon: Phone,
        path: "/restaurant/support/contact"
      },
      {
        label: "System Status",
        icon: Gauge,
        path: "/restaurant/support/status"
      }
    ]
  }
];

// Helper function to filter navigation based on user role
export function filterNavByRole(nav: NavItem[], userRole: UserRole): NavItem[] {
  return nav
    .filter(item => {
      if (!item.requiredRole) return true;
      return item.requiredRole.includes(userRole);
    })
    .map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            if (!child.requiredRole) return true;
            return child.requiredRole.includes(userRole);
          })
        };
      }
      return item;
    });
}
