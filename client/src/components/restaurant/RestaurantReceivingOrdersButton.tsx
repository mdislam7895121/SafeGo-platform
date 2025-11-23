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
        inline-flex items-center justify-center gap-3 h-11 px-5 rounded-full font-semibold text-[15px]
        bg-[#111] dark:bg-[#111] transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        active:scale-[0.98]
        ${isReceivingOrders 
          ? 'border-2 border-green-600 text-green-600 hover:border-green-500 hover:text-green-500 focus-visible:ring-green-600' 
          : 'border-2 border-red-600 text-red-600 hover:border-red-500 hover:text-red-500 focus-visible:ring-red-600'
        }
      `}
    >
      {/* Power Icon */}
      <Power 
        className="w-[18px] h-[18px] flex-shrink-0 transition-all duration-200"
      />
      
      {/* Label Text - Always visible */}
      <span className="whitespace-nowrap">
        {isReceivingOrders ? "Online" : "Offline"}
      </span>
    </button>
  );
}
