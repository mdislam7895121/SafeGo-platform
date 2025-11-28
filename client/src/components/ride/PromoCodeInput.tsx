import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Loader2, Check, AlertCircle } from "lucide-react";
import { useRideBooking, type PromoValidation } from "@/contexts/RideBookingContext";
import { apiRequest } from "@/lib/queryClient";

export interface PromoCodeInputProps {
  originalFare: number;
  rideTypeCode: string;
  countryCode?: string;
  cityCode?: string;
  isWalletPayment?: boolean;
  onPromoApplied?: (validation: PromoValidation) => void;
  onPromoCleared?: () => void;
  className?: string;
  compact?: boolean;
}

type PromoState = "idle" | "validating" | "success" | "error";

export function PromoCodeInput({
  originalFare,
  rideTypeCode,
  countryCode = "US",
  cityCode,
  isWalletPayment = false,
  onPromoApplied,
  onPromoCleared,
  className = "",
  compact = false,
}: PromoCodeInputProps) {
  const { state, setPromoValidation, clearPromo } = useRideBooking();
  const [inputValue, setInputValue] = useState("");
  const [promoState, setPromoState] = useState<PromoState>(
    state.promoValidation?.valid ? "success" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validatePromoCode = useCallback(async (code: string) => {
    if (!code.trim()) return;

    setPromoState("validating");
    setErrorMessage(null);

    try {
      const response = await apiRequest("/api/promos/code/validate", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          originalFare,
          rideTypeCode,
          countryCode,
          cityCode,
          isWalletPayment,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.valid) {
        const validation: PromoValidation = {
          code: data.code,
          valid: true,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          finalFare: data.finalFare,
          displayMessage: data.displayMessage,
          promoCodeId: data.promoCodeId,
          discountType: data.discountType,
          isCapped: data.discountType === "CAPPED_PERCENTAGE" && 
            data.discountPercent < (data.discountValue || 0),
        };
        setPromoValidation(validation);
        setPromoState("success");
        setInputValue("");
        onPromoApplied?.(validation);
      } else {
        setPromoState("error");
        setErrorMessage(data.errorMessage || "Invalid promo code");
        setPromoValidation(null);
      }
    } catch (error) {
      console.error("[PromoCodeInput] Validation error:", error);
      setPromoState("error");
      setErrorMessage("Failed to validate promo code. Please try again.");
      setPromoValidation(null);
    }
  }, [originalFare, rideTypeCode, countryCode, cityCode, isWalletPayment, setPromoValidation, onPromoApplied]);

  const handleApply = useCallback(() => {
    validatePromoCode(inputValue);
  }, [inputValue, validatePromoCode]);

  const handleRemove = useCallback(() => {
    clearPromo();
    setPromoState("idle");
    setErrorMessage(null);
    setInputValue("");
    onPromoCleared?.();
  }, [clearPromo, onPromoCleared]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      handleApply();
    }
  }, [inputValue, handleApply]);

  const isApplied = state.promoValidation?.valid && promoState === "success";
  const promoValidation = state.promoValidation;

  if (isApplied && promoValidation) {
    return (
      <div className={`${className}`} data-testid="promo-code-applied">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant="outline" 
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 px-3 py-1.5 text-sm"
            data-testid="promo-applied-badge"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {promoValidation.code}
            {promoValidation.discountType === "CAPPED_PERCENTAGE" && (
              <span className="ml-1 text-[10px] opacity-80">(max reached)</span>
            )}
          </Badge>
          
          <span className="text-sm text-green-600 dark:text-green-400 font-medium" data-testid="promo-savings-text">
            -{formatCurrency(promoValidation.discountAmount)}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            data-testid="button-remove-promo"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Remove</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`} data-testid="promo-code-input-container">
      <div className={`flex gap-2 ${compact ? "" : "items-stretch"}`}>
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Enter promo code"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value.toUpperCase());
              if (promoState === "error") {
                setPromoState("idle");
                setErrorMessage(null);
              }
            }}
            onKeyDown={handleKeyDown}
            className={`pl-9 h-10 sm:h-11 ${
              promoState === "error" 
                ? "border-red-300 dark:border-red-700 focus-visible:ring-red-500" 
                : ""
            }`}
            disabled={promoState === "validating"}
            data-testid="input-promo-code"
          />
        </div>
        
        <Button
          variant="outline"
          onClick={handleApply}
          disabled={!inputValue.trim() || promoState === "validating"}
          className="h-10 sm:h-11 px-4 min-w-[72px]"
          data-testid="button-apply-promo"
        >
          {promoState === "validating" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="sm:hidden">Apply</span>
              <span className="hidden sm:inline">Apply</span>
            </>
          )}
        </Button>
      </div>

      {promoState === "error" && errorMessage && (
        <div 
          className="flex items-start gap-2 mt-2 text-sm text-red-600 dark:text-red-400"
          data-testid="promo-error-message"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default PromoCodeInput;
