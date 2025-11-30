import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from "react";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  specialInstructions?: string;
  modifiers?: CartItemModifier[];
}

export interface CartItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  cuisineType?: string;
  address?: string;
  logoUrl?: string | null;
  deliveryFee?: number;
  minOrderAmount?: number;
  estimatedDeliveryMinutes?: number;
}

export interface DeliveryAddress {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
  label?: string;
}

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tax: number;
  discount: number;
  total: number;
  itemCount: number;
}

export interface EatsCartState {
  restaurant: RestaurantInfo | null;
  items: CartItem[];
  deliveryAddress: DeliveryAddress | null;
  promoCode: string | null;
  promoDiscount: number;
  promoFreeDelivery: boolean;
  paymentMethod: string | null;
  specialInstructions: string;
  isLoading: boolean;
  error: string | null;
}

type EatsCartAction =
  | { type: "SET_RESTAURANT"; restaurant: RestaurantInfo }
  | { type: "ADD_ITEM"; item: Omit<CartItem, "id"> }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "UPDATE_QUANTITY"; itemId: string; quantity: number }
  | { type: "UPDATE_ITEM_INSTRUCTIONS"; itemId: string; instructions: string }
  | { type: "SET_DELIVERY_ADDRESS"; address: DeliveryAddress }
  | { type: "SET_PROMO"; code: string; discount: number; isFreeDelivery?: boolean }
  | { type: "CLEAR_PROMO" }
  | { type: "SET_PAYMENT_METHOD"; method: string }
  | { type: "SET_SPECIAL_INSTRUCTIONS"; instructions: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_CART" }
  | { type: "CLEAR_CART_FOR_NEW_RESTAURANT"; restaurant: RestaurantInfo }
  | { type: "CLEAR_AND_ADD_ITEM"; restaurant: RestaurantInfo; item: Omit<CartItem, "id"> }
  | { type: "RESTORE_STATE"; state: Partial<EatsCartState> }
  | { type: "SET_CART_FROM_REORDER"; restaurant: RestaurantInfo; items: Omit<CartItem, "id">[] };

const initialState: EatsCartState = {
  restaurant: null,
  items: [],
  deliveryAddress: null,
  promoCode: null,
  promoDiscount: 0,
  promoFreeDelivery: false,
  paymentMethod: null,
  specialInstructions: "",
  isLoading: false,
  error: null,
};

function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function eatsCartReducer(state: EatsCartState, action: EatsCartAction): EatsCartState {
  switch (action.type) {
    case "SET_RESTAURANT":
      return { ...state, restaurant: action.restaurant, error: null };

    case "ADD_ITEM": {
      const existingItemIndex = state.items.findIndex(
        (item) =>
          item.menuItemId === action.item.menuItemId &&
          item.specialInstructions === (action.item.specialInstructions || "") &&
          JSON.stringify(item.modifiers || []) === JSON.stringify(action.item.modifiers || [])
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + action.item.quantity,
        };
        return { ...state, items: updatedItems, error: null };
      }

      const newItem: CartItem = {
        ...action.item,
        id: generateItemId(),
      };
      return { ...state, items: [...state.items, newItem], error: null };
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.itemId),
        error: null,
      };

    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== action.itemId),
          error: null,
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId ? { ...item, quantity: action.quantity } : item
        ),
        error: null,
      };
    }

    case "UPDATE_ITEM_INSTRUCTIONS":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.itemId
            ? { ...item, specialInstructions: action.instructions }
            : item
        ),
        error: null,
      };

    case "SET_DELIVERY_ADDRESS":
      return { ...state, deliveryAddress: action.address, error: null };

    case "SET_PROMO":
      return { 
        ...state, 
        promoCode: action.code, 
        promoDiscount: action.discount, 
        promoFreeDelivery: action.isFreeDelivery ?? false,
        error: null 
      };

    case "CLEAR_PROMO":
      return { ...state, promoCode: null, promoDiscount: 0, promoFreeDelivery: false, error: null };

    case "SET_PAYMENT_METHOD":
      return { ...state, paymentMethod: action.method, error: null };

    case "SET_SPECIAL_INSTRUCTIONS":
      return { ...state, specialInstructions: action.instructions, error: null };

    case "SET_LOADING":
      return { ...state, isLoading: action.loading };

    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };

    case "CLEAR_CART":
      return { ...initialState };

    case "CLEAR_CART_FOR_NEW_RESTAURANT":
      return {
        ...initialState,
        restaurant: action.restaurant,
      };

    case "CLEAR_AND_ADD_ITEM": {
      const newItem: CartItem = {
        ...action.item,
        id: generateItemId(),
      };
      return {
        ...initialState,
        restaurant: action.restaurant,
        items: [newItem],
      };
    }

    case "RESTORE_STATE":
      return { ...state, ...action.state };

    case "SET_CART_FROM_REORDER": {
      const newItems: CartItem[] = action.items.map((item) => ({
        ...item,
        id: generateItemId(),
      }));
      return {
        ...initialState,
        restaurant: action.restaurant,
        items: newItems,
      };
    }

    default:
      return state;
  }
}

interface EatsCartContextType {
  state: EatsCartState;
  addItem: (item: Omit<CartItem, "id">, restaurant: RestaurantInfo) => { success: boolean; newCount: number };
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemInstructions: (itemId: string, instructions: string) => void;
  setDeliveryAddress: (address: DeliveryAddress) => void;
  setPromoCode: (code: string, discount: number, isFreeDelivery?: boolean) => void;
  clearPromo: () => void;
  setPaymentMethod: (method: string) => void;
  setSpecialInstructions: (instructions: string) => void;
  clearCart: () => void;
  clearCartForNewRestaurant: (restaurant: RestaurantInfo) => void;
  clearAndAddItem: (item: Omit<CartItem, "id">, restaurant: RestaurantInfo) => void;
  setCartFromReorder: (restaurant: RestaurantInfo, items: Omit<CartItem, "id">[]) => void;
  setError: (error: string | null) => void;
  getItemCount: () => number;
  getItemQuantity: (menuItemId: string) => number;
  getTotals: () => CartTotals;
  isFromDifferentRestaurant: (restaurantId: string) => boolean;
  isEmpty: boolean;
  hasMinimumOrder: boolean;
}

const EatsCartContext = createContext<EatsCartContextType | undefined>(undefined);

const STORAGE_KEY = "safego_eats_cart";
const SERVICE_FEE_RATE = 0.05;
const TAX_RATE = 0.0875;

export function EatsCartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(eatsCartReducer, initialState);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.items && parsed.items.length > 0) {
          dispatch({ type: "RESTORE_STATE", state: parsed });
        }
      }
    } catch (e) {
      console.warn("[EatsCart] Failed to restore cart state:", e);
    }
  }, []);

  useEffect(() => {
    if (state.items.length > 0 || state.restaurant) {
      try {
        const toStore = {
          restaurant: state.restaurant,
          items: state.items,
          deliveryAddress: state.deliveryAddress,
          promoCode: state.promoCode,
          promoDiscount: state.promoDiscount,
          specialInstructions: state.specialInstructions,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (e) {
        console.warn("[EatsCart] Failed to persist cart state:", e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state.items, state.restaurant, state.deliveryAddress, state.promoCode, state.promoDiscount, state.specialInstructions]);

  const addItem = useCallback((item: Omit<CartItem, "id">, restaurant: RestaurantInfo): { success: boolean; newCount: number } => {
    if (!restaurant) {
      return { success: false, newCount: state.items.reduce((t, i) => t + i.quantity, 0) };
    }

    if (state.restaurant && state.restaurant.id !== restaurant.id && state.items.length > 0) {
      return { success: false, newCount: state.items.reduce((t, i) => t + i.quantity, 0) };
    }

    if (!state.restaurant || state.restaurant.id !== restaurant.id) {
      dispatch({ type: "SET_RESTAURANT", restaurant });
    }

    dispatch({ type: "ADD_ITEM", item });
    
    const existingItem = state.items.find(
      (i) =>
        i.menuItemId === item.menuItemId &&
        i.specialInstructions === (item.specialInstructions || "") &&
        JSON.stringify(i.modifiers || []) === JSON.stringify(item.modifiers || [])
    );
    
    const currentCount = state.items.reduce((t, i) => t + i.quantity, 0);
    const newCount = existingItem 
      ? currentCount + item.quantity
      : currentCount + item.quantity;
    
    return { success: true, newCount };
  }, [state.restaurant, state.items]);

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: "REMOVE_ITEM", itemId });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", itemId, quantity });
  }, []);

  const updateItemInstructions = useCallback((itemId: string, instructions: string) => {
    dispatch({ type: "UPDATE_ITEM_INSTRUCTIONS", itemId, instructions });
  }, []);

  const setDeliveryAddress = useCallback((address: DeliveryAddress) => {
    dispatch({ type: "SET_DELIVERY_ADDRESS", address });
  }, []);

  const setPromoCode = useCallback((code: string, discount: number, isFreeDelivery?: boolean) => {
    dispatch({ type: "SET_PROMO", code, discount, isFreeDelivery });
  }, []);

  const clearPromo = useCallback(() => {
    dispatch({ type: "CLEAR_PROMO" });
  }, []);

  const setPaymentMethod = useCallback((method: string) => {
    dispatch({ type: "SET_PAYMENT_METHOD", method });
  }, []);

  const setSpecialInstructions = useCallback((instructions: string) => {
    dispatch({ type: "SET_SPECIAL_INSTRUCTIONS", instructions });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const clearCartForNewRestaurant = useCallback((restaurant: RestaurantInfo) => {
    dispatch({ type: "CLEAR_CART_FOR_NEW_RESTAURANT", restaurant });
  }, []);

  const clearAndAddItem = useCallback((item: Omit<CartItem, "id">, restaurant: RestaurantInfo) => {
    dispatch({ type: "CLEAR_AND_ADD_ITEM", restaurant, item });
  }, []);

  const setCartFromReorder = useCallback((restaurant: RestaurantInfo, items: Omit<CartItem, "id">[]) => {
    dispatch({ type: "SET_CART_FROM_REORDER", restaurant, items });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", error });
  }, []);

  const getItemCount = useCallback((): number => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  }, [state.items]);

  const getItemQuantity = useCallback((menuItemId: string): number => {
    return state.items
      .filter((item) => item.menuItemId === menuItemId)
      .reduce((total, item) => total + item.quantity, 0);
  }, [state.items]);

  const getTotals = useCallback((): CartTotals => {
    const subtotal = state.items.reduce((total, item) => {
      const modifiersTotal = (item.modifiers || []).reduce((sum, mod) => sum + mod.price, 0);
      return total + (item.price + modifiersTotal) * item.quantity;
    }, 0);

    const baseDeliveryFee = state.restaurant?.deliveryFee ?? 0;
    const deliveryFee = state.promoFreeDelivery ? 0 : baseDeliveryFee;
    const serviceFee = subtotal > 0 ? subtotal * SERVICE_FEE_RATE : 0;
    const tax = subtotal > 0 ? subtotal * TAX_RATE : 0;
    const discount = state.promoDiscount;
    const total = Math.max(0, subtotal + deliveryFee + serviceFee + tax - discount);
    const itemCount = getItemCount();

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      serviceFee: Math.round(serviceFee * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      itemCount,
    };
  }, [state.items, state.restaurant?.deliveryFee, state.promoDiscount, state.promoFreeDelivery, getItemCount]);

  const isFromDifferentRestaurant = useCallback((restaurantId: string): boolean => {
    return state.restaurant !== null && state.restaurant.id !== restaurantId && state.items.length > 0;
  }, [state.restaurant, state.items.length]);

  const isEmpty = state.items.length === 0;
  const hasMinimumOrder = getTotals().subtotal >= (state.restaurant?.minOrderAmount ?? 0);

  return (
    <EatsCartContext.Provider
      value={{
        state,
        addItem,
        removeItem,
        updateQuantity,
        updateItemInstructions,
        setDeliveryAddress,
        setPromoCode,
        clearPromo,
        setPaymentMethod,
        setSpecialInstructions,
        clearCart,
        clearCartForNewRestaurant,
        clearAndAddItem,
        setCartFromReorder,
        setError,
        getItemCount,
        getItemQuantity,
        getTotals,
        isFromDifferentRestaurant,
        isEmpty,
        hasMinimumOrder,
      }}
    >
      {children}
    </EatsCartContext.Provider>
  );
}

export function useEatsCart() {
  const context = useContext(EatsCartContext);
  if (!context) {
    throw new Error("useEatsCart must be used within an EatsCartProvider");
  }
  return context;
}
