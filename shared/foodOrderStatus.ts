export const FOOD_ORDER_STATUSES = [
  "placed",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "driver_assigned",
  "driver_arriving",
  "picked_up",
  "on_the_way",
  "delivered",
  "cancelled",
] as const;

export type FoodOrderStatus = typeof FOOD_ORDER_STATUSES[number];

export interface FoodOrderStatusInfo {
  status: FoodOrderStatus;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const FOOD_ORDER_STATUS_INFO: Record<FoodOrderStatus, FoodOrderStatusInfo> = {
  placed: {
    status: "placed",
    label: "Order Received",
    description: "Your order has been received by the restaurant",
    icon: "ClipboardCheck",
    color: "blue",
  },
  accepted: {
    status: "accepted",
    label: "Restaurant Accepted",
    description: "The restaurant has accepted your order",
    icon: "CheckCircle",
    color: "green",
  },
  preparing: {
    status: "preparing",
    label: "Preparing Order",
    description: "The restaurant is preparing your food",
    icon: "ChefHat",
    color: "orange",
  },
  ready_for_pickup: {
    status: "ready_for_pickup",
    label: "Ready for Pickup",
    description: "Your order is ready and waiting for a driver",
    icon: "Package",
    color: "purple",
  },
  driver_assigned: {
    status: "driver_assigned",
    label: "Driver Assigned",
    description: "A driver has been assigned to your order",
    icon: "UserCheck",
    color: "teal",
  },
  driver_arriving: {
    status: "driver_arriving",
    label: "Driver Arriving at Restaurant",
    description: "Your driver is heading to the restaurant",
    icon: "Navigation",
    color: "cyan",
  },
  picked_up: {
    status: "picked_up",
    label: "Order Picked Up",
    description: "The driver has picked up your order",
    icon: "ShoppingBag",
    color: "indigo",
  },
  on_the_way: {
    status: "on_the_way",
    label: "On the Way",
    description: "Your order is on the way to you",
    icon: "Truck",
    color: "emerald",
  },
  delivered: {
    status: "delivered",
    label: "Delivered",
    description: "Your order has been delivered",
    icon: "CheckCircle2",
    color: "green",
  },
  cancelled: {
    status: "cancelled",
    label: "Cancelled",
    description: "This order has been cancelled",
    icon: "XCircle",
    color: "red",
  },
};

export function getStatusIndex(status: FoodOrderStatus): number {
  const orderFlow: FoodOrderStatus[] = [
    "placed",
    "accepted",
    "preparing",
    "ready_for_pickup",
    "driver_assigned",
    "driver_arriving",
    "picked_up",
    "on_the_way",
    "delivered",
  ];
  return orderFlow.indexOf(status);
}

export function isStatusCompleted(currentStatus: FoodOrderStatus, checkStatus: FoodOrderStatus): boolean {
  if (currentStatus === "cancelled") return false;
  const currentIndex = getStatusIndex(currentStatus);
  const checkIndex = getStatusIndex(checkStatus);
  return checkIndex <= currentIndex;
}

export function isDeliveryPhase(status: FoodOrderStatus): boolean {
  return ["driver_assigned", "driver_arriving", "picked_up", "on_the_way"].includes(status);
}

export function isActiveOrder(status: FoodOrderStatus): boolean {
  return !["delivered", "cancelled"].includes(status);
}
