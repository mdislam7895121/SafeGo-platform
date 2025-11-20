import { useLocation } from "wouter";
import UserSupportChat from "@/components/support/UserSupportChat";

export default function RestaurantSupport() {
  const [, setLocation] = useLocation();

  return (
    <UserSupportChat onBack={() => setLocation("/restaurant")} />
  );
}
