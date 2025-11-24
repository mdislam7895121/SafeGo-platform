import { Power } from "lucide-react";

interface RestaurantReceivingOrdersButtonProps {
  isReceivingOrders: boolean;
  onToggle: (status: boolean) => void;
}

export function RestaurantReceivingOrdersButton({
  isReceivingOrders,
  onToggle
}: RestaurantReceivingOrdersButtonProps) {
  return (
    <div className="flex justify-center items-center w-full sm:w-auto">
      <button
        onClick={() => onToggle(!isReceivingOrders)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(!isReceivingOrders);
          }
        }}
        role="switch"
        aria-checked={isReceivingOrders}
        aria-label={
          isReceivingOrders 
            ? "Restaurant is online. Press to go offline." 
            : "Restaurant is offline. Press to go online."
        }
        data-testid="button-receiving-orders-toggle"
        className={`
          inline-flex items-center justify-center gap-3 px-5 h-[46px] rounded-[9999px] font-semibold text-[15px]
          transition-all duration-150 cursor-pointer min-w-[44px] min-h-[44px]
          focus-visible:outline-2 focus-visible:outline-[#4B9EFF] focus-visible:outline-offset-[3px]
          active:scale-[0.98]
          ${isReceivingOrders 
            ? 'bg-[#0CCE6B] text-white shadow-[0_0_12px_rgba(12,206,107,0.5)] hover:bg-[#0BBD61]' 
            : 'bg-[#E5E7EB] text-[#374151] border border-[#D1D5DB] hover:bg-[#D1D5DB]'
          }
        `}
      >
        {/* Power Icon */}
        <Power 
          className="w-[22px] h-[22px] flex-shrink-0 transition-all duration-150"
        />
        
        {/* Label Text - Always visible, no wrap */}
        <span className="whitespace-nowrap">
          {isReceivingOrders ? "Online" : "Offline"}
        </span>
      </button>
    </div>
  );
}
