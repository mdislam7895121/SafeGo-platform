import { Power } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RestaurantReceivingOrdersButtonProps {
  isReceivingOrders: boolean;
  onToggle: (status: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function RestaurantReceivingOrdersButton({
  isReceivingOrders,
  onToggle,
  disabled = false,
  disabledReason
}: RestaurantReceivingOrdersButtonProps) {
  const button = (
    <button
      onClick={() => !disabled && onToggle(!isReceivingOrders)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle(!isReceivingOrders);
        }
      }}
      role="switch"
      aria-checked={isReceivingOrders}
      aria-disabled={disabled}
      aria-label={
        disabled
          ? disabledReason || "Restaurant cannot go online - verification required"
          : isReceivingOrders 
            ? "Restaurant is online. Press to go offline." 
            : "Restaurant is offline. Press to go online."
      }
      data-testid="button-receiving-orders-toggle"
      className={`
        inline-flex items-center justify-center gap-3 px-5 h-[46px] rounded-[9999px] font-semibold text-[15px]
        transition-all duration-150 min-w-[44px] min-h-[44px]
        focus-visible:outline-2 focus-visible:outline-[#4B9EFF] focus-visible:outline-offset-[3px]
        ${disabled 
          ? 'bg-[#E5E7EB] text-[#9CA3AF] border border-[#D1D5DB] cursor-not-allowed opacity-60' 
          : isReceivingOrders 
            ? 'bg-[#0CCE6B] text-white shadow-[0_0_12px_rgba(12,206,107,0.5)] hover:bg-[#0BBD61] cursor-pointer active:scale-[0.98]' 
            : 'bg-[#E5E7EB] text-[#374151] border border-[#D1D5DB] hover:bg-[#D1D5DB] cursor-pointer active:scale-[0.98]'
        }
      `}
    >
      <Power 
        className="w-[22px] h-[22px] flex-shrink-0 transition-all duration-150"
      />
      <span className="whitespace-nowrap">
        {disabled ? "Offline" : isReceivingOrders ? "Online" : "Offline"}
      </span>
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <div className="flex items-center w-full sm:w-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px] text-center">
            <p>{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full sm:w-auto">
      {button}
    </div>
  );
}
