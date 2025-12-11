import { useAuth } from "@/contexts/AuthContext";
import { useEatsCart } from "@/contexts/EatsCartContext";
import { useRideBooking } from "@/contexts/RideBookingContext";
import { useNotificationSound } from "@/contexts/NotificationSoundContext";
import { queryClient } from "@/lib/queryClient";

/**
 * Centralized logout hook that clears all user-specific state before redirecting.
 * 
 * When adding new contexts that store user-specific data, add their reset/clear
 * methods here to ensure they are properly flushed on logout.
 * 
 * Current contexts cleared:
 * - EatsCartContext (food cart items)
 * - RideBookingContext (ride booking state)
 * - NotificationSoundContext (user sound preferences)
 * - QueryClient cache (all cached API responses)
 * 
 * Future contexts to add when implemented:
 * - ParcelContext (parcel delivery state)
 * - SupportChatContext (support chat history/state)
 */
export function useLogout() {
  const { logout: authLogout } = useAuth();
  const { clearCart } = useEatsCart();
  const { clearBooking } = useRideBooking();
  const { resetToDefault: resetNotificationSound } = useNotificationSound();

  const performLogout = () => {
    clearCart();
    clearBooking();
    resetNotificationSound();
    queryClient.clear();
    authLogout();
  };

  return { performLogout };
}
