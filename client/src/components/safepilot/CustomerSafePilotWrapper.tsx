import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerSafePilotWidget, ServiceType } from './CustomerSafePilotWidget';

function detectServiceFromPath(path: string): { service: ServiceType; entityId?: string; entityType?: 'ride' | 'order' | 'delivery' } {
  if (!path) return { service: 'ALL' };
  
  const lowerPath = path.toLowerCase();
  
  const rideIdMatch = path.match(/\/ride[s]?\/([a-f0-9-]{36})/i);
  const orderIdMatch = path.match(/\/order[s]?\/([a-f0-9-]{36})/i) || path.match(/\/food.*\/([a-f0-9-]{36})/i);
  const parcelIdMatch = path.match(/\/parcel[s]?\/([a-f0-9-]{36})/i) || path.match(/\/deliver[y|ies]+\/([a-f0-9-]{36})/i);

  if (lowerPath.startsWith('/customer/ride') || lowerPath.startsWith('/ride') || lowerPath.startsWith('/trip') || lowerPath.startsWith('/unified-booking')) {
    return {
      service: 'RIDE',
      entityId: rideIdMatch?.[1],
      entityType: rideIdMatch ? 'ride' : undefined,
    };
  }
  
  if (lowerPath.startsWith('/customer/food') || lowerPath.startsWith('/customer/eats') || lowerPath.startsWith('/food') || lowerPath.startsWith('/eats') || lowerPath.startsWith('/checkout')) {
    return {
      service: 'FOOD',
      entityId: orderIdMatch?.[1],
      entityType: orderIdMatch ? 'order' : undefined,
    };
  }
  
  if (lowerPath.startsWith('/customer/parcel') || lowerPath.startsWith('/parcel') || lowerPath.startsWith('/deliver')) {
    return {
      service: 'PARCEL',
      entityId: parcelIdMatch?.[1],
      entityType: parcelIdMatch ? 'delivery' : undefined,
    };
  }

  return { service: 'ALL' };
}

const CUSTOMER_PATH_PREFIXES = [
  '/customer/',
  '/customer/profile',
  '/customer/wallet',
  '/customer/ride',
  '/customer/food',
  '/customer/eats',
  '/customer/parcel',
  '/customer/orders',
  '/customer/notifications',
  '/customer/support',
  '/customer/safety',
  '/ride/',
  '/food/',
  '/eats/',
  '/parcel/',
  '/deliver/',
  '/checkout/',
  '/trip/',
  '/unified-booking',
];

const EXCLUDED_PATH_PREFIXES = [
  '/admin',
  '/driver',
  '/restaurant',
  '/shop-partner',
  '/ticket-operator',
  '/partner',
];

function isCustomerPath(path: string): boolean {
  if (!path) return false;
  const lowerPath = path.toLowerCase();
  
  if (EXCLUDED_PATH_PREFIXES.some(prefix => lowerPath.startsWith(prefix))) {
    return false;
  }
  
  return CUSTOMER_PATH_PREFIXES.some(prefix => lowerPath.startsWith(prefix));
}

export function CustomerSafePilotWrapper() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isCustomerRole = user?.role?.toLowerCase() === 'customer' || user?.role?.toLowerCase() === 'pending_customer';
  
  const shouldShow = useMemo(() => {
    if (!user || !isCustomerRole) return false;
    if (!location) return false;
    
    return isCustomerPath(location);
  }, [location, user, isCustomerRole]);

  const contextInfo = useMemo(() => {
    return detectServiceFromPath(location);
  }, [location]);

  if (!shouldShow) {
    return null;
  }

  return (
    <CustomerSafePilotWidget
      service={contextInfo.service}
      entityId={contextInfo.entityId}
      entityType={contextInfo.entityType}
    />
  );
}

export default CustomerSafePilotWrapper;
