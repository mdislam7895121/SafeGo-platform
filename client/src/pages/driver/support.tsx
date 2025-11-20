import { useLocation } from "wouter";
import UserSupportChat from "@/components/support/UserSupportChat";

export default function DriverSupport() {
  const [, setLocation] = useLocation();

  return (
    <UserSupportChat onBack={() => setLocation("/driver")} />
  );
}
