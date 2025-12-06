import { Link } from "wouter";
import { 
  Sparkles, 
  Car, 
  Target,
  Gift,
  Percent,
  Calendar
} from "lucide-react";
import { StatCard, ManagementCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";

export default function AdminPromotions() {
  const promotionTypes = [
    {
      name: "Driver Promotions",
      icon: Car,
      href: "/admin/driver-promotions",
      description: "Create incentives and bonuses for drivers",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      name: "Ride Promotions",
      icon: Target,
      href: "/admin/ride-promotions",
      description: "Customer ride discounts and promotional campaigns",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      name: "Referral Bonuses",
      icon: Gift,
      href: "/admin/referral-settings",
      description: "Manage referral bonus amounts and campaigns",
      color: "text-pink-600",
      bgColor: "bg-pink-50 dark:bg-pink-950",
    },
    {
      name: "Opportunity Bonuses",
      icon: Sparkles,
      href: "/admin/opportunity-bonuses",
      description: "Ride incentives, boost zones, and promotional payouts",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] dark:text-white tracking-[-0.02em]">
            Promotions Center
          </h1>
          <p className="text-[14px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Manage all promotional campaigns and incentives across the platform
          </p>
        </div>
      </div>

      <SectionHeader 
        title="Promotion Types" 
        icon={Sparkles}
        iconColor="text-pink-600"
        testId="section-promotion-types"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {promotionTypes.map((promo) => (
          <Link key={promo.name} href={promo.href}>
            <ManagementCard
              icon={promo.icon}
              iconColor={promo.color}
              iconBgColor={promo.bgColor}
              title={promo.name}
              description={promo.description}
              testId={`card-${promo.name.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </Link>
        ))}
      </div>

      <SectionHeader 
        title="Quick Stats" 
        icon={Percent}
        iconColor="text-green-600"
        testId="section-promo-stats"
      />

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Target}
          iconColor="text-blue-600"
          value={0}
          label="Active Campaigns"
          testId="card-active-campaigns"
        />
        <StatCard
          icon={Gift}
          iconColor="text-pink-600"
          value={0}
          label="Referrals This Month"
          testId="card-referrals-month"
        />
        <StatCard
          icon={Sparkles}
          iconColor="text-amber-600"
          value={0}
          label="Bonuses Paid"
          testId="card-bonuses-paid"
        />
        <StatCard
          icon={Calendar}
          iconColor="text-green-600"
          value={0}
          label="Upcoming Promos"
          testId="card-upcoming-promos"
        />
      </div>
    </div>
  );
}
