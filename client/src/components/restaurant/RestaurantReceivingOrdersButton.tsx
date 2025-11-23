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
      style={{
        backgroundColor: isReceivingOrders ? '#0CCE6B' : '#E5E7EB',
        color: isReceivingOrders ? 'white' : '#374151',
        border: isReceivingOrders ? 'none' : '1px solid #D1D5DB',
      }}
      className={`
        inline-flex items-center justify-center gap-3 min-h-[46px] h-[46px] px-5 rounded-full font-semibold text-[15px]
        transition-all duration-150 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B9EFF] focus-visible:ring-offset-2
        active:scale-[0.98]
        hover:opacity-90
      `}
    >
      {/* Power Icon - No circle wrapper */}
      <Power 
        className={`
          w-[22px] h-[22px] flex-shrink-0 transition-all duration-150
          ${isReceivingOrders ? 'drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]' : ''}
        `}
        style={{
          color: isReceivingOrders ? 'white' : '#374151'
        }}
      />
      
      {/* Label Text - Always visible with responsive handling */}
      <span className="whitespace-nowrap">
        {isReceivingOrders ? "Online" : "Offline"}
      </span>
    </button>
  );
}
