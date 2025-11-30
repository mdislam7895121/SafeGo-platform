interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number;
  menuItemId?: string;
}

interface OrderWithFinancials {
  items: OrderItem[];
  subtotal?: number | null;
  serviceFare?: number | null;
  deliveryFee?: number | null;
  taxAmount?: number | null;
  tipAmount?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
}

export interface OrderTotals {
  itemsSubtotal: number;
  deliveryFee: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
  hasBreakdown: boolean;
}

export function computeOrderTotals(order: OrderWithFinancials): OrderTotals {
  const hasBreakdown = order.subtotal != null;
  const hasServiceFare = order.serviceFare != null;
  
  const computedItemsSubtotal = (order.items || []).reduce((sum, item) => 
    sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);
  
  const itemsSubtotal = hasBreakdown 
    ? (Number(order.subtotal) || 0)
    : computedItemsSubtotal;
  
  const deliveryFee = Number(order.deliveryFee) || 0;
  const taxAmount = Number(order.taxAmount) || 0;
  const tipAmount = Number(order.tipAmount) || 0;
  const discountAmount = Number(order.discountAmount) || 0;
  
  let total: number;
  if (hasBreakdown) {
    total = itemsSubtotal + deliveryFee + taxAmount + tipAmount - discountAmount;
  } else if (hasServiceFare) {
    total = Number(order.serviceFare) || 0;
  } else {
    total = computedItemsSubtotal + deliveryFee + taxAmount + tipAmount - discountAmount;
  }
  
  return {
    itemsSubtotal,
    deliveryFee,
    taxAmount,
    tipAmount,
    discountAmount,
    total,
    hasBreakdown,
  };
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
