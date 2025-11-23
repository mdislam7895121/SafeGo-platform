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
      className={`
        inline-flex items-center gap-2 h-9 px-4 rounded-full font-medium text-sm
        bg-black dark:bg-black transition-all duration-200
        border-2 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${isReceivingOrders 
          ? 'border-green-600 text-green-600 hover:border-green-500 hover:text-green-500 focus-visible:ring-green-600' 
          : 'border-red-600 text-red-600 hover:border-red-500 hover:text-red-500 focus-visible:ring-red-600'
        }
      `}
      aria-pressed={isReceivingOrders}
      aria-label={
        isReceivingOrders 
          ? "Restaurant is online. Tap to go offline." 
          : "Restaurant is offline. Tap to go online."
      }
      data-testid="button-receiving-orders-toggle"
    >
      {/* Power Icon in Circle */}
      <div 
        className={`
          flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-200
          ${isReceivingOrders 
            ? 'border-green-600' 
            : 'border-red-600'
          }
        `}
      >
        <Power 
          className={`
            h-3 w-3 transition-all duration-200
            ${isReceivingOrders 
              ? 'text-green-600' 
              : 'text-red-600'
            }
          `}
        />
      </div>
      
      {/* Label Text - Show on sm and larger screens */}
      <span className="hidden sm:inline whitespace-nowrap">
        {isReceivingOrders ? "Online" : "Offline"}
      </span>
    </button>
  );
}
