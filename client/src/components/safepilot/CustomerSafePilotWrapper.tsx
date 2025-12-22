import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerSafePilotWidget, ServiceType } from './CustomerSafePilotWidget';

function detectServiceFromPath(path: string): { service: ServiceType; entityId?: string; entityType?: 'ride' | 'order' | 'delivery' } {
  const lowerPath = path.toLowerCase();
  
  const rideIdMatch = path.match(/\/ride[s]?\/([a-f0-9-]{36})/i);
  const orderIdMatch = path.match(/\/order[s]?\/([a-f0-9-]{36})/i) || path.match(/\/food.*\/([a-f0-9-]{36})/i);
  const parcelIdMatch = path.match(/\/parcel[s]?\/([a-f0-9-]{36})/i) || path.match(/\/deliver[y|ies]+\/([a-f0-9-]{36})/i);

  if (lowerPath.includes('/ride') || lowerPath.includes('/trip')) {
    return {
      service: 'RIDE',
      entityId: rideIdMatch?.[1],
      entityType: rideIdMatch ? 'ride' : undefined,
    };
  }
  
  if (lowerPath.includes('/food') || lowerPath.includes('/eats') || lowerPath.includes('/restaurant') || lowerPath.includes('/checkout')) {
    return {
      service: 'FOOD',
      entityId: orderIdMatch?.[1],
      entityType: orderIdMatch ? 'order' : undefined,
    };
  }
  
  if (lowerPath.includes('/parcel') || lowerPath.includes('/deliver')) {
    return {
      service: 'PARCEL',
      entityId: parcelIdMatch?.[1],
      entityType: parcelIdMatch ? 'delivery' : undefined,
    };
  }

  return { service: 'ALL' };
}

const CUSTOMER_PATHS = [
  '/customer',
  '/ride',
  '/food',
  '/eats',
  '/parcel',
  '/deliver',
  '/profile',
  '/wallet',
  '/orders',
  '/checkout',
  '/trip',
  '/booking',
  '/unified-booking',
];

function isCustomerPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return CUSTOMER_PATHS.some(prefix => lowerPath.startsWith(prefix) || lowerPath.includes(prefix));
}

export function CustomerSafePilotWrapper() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isCustomerRole = user?.role?.toLowerCase() === 'customer' || user?.role?.toLowerCase() === 'pending_customer';
  
  const shouldShow = useMemo(() => {
    if (!user || !isCustomerRole) return false;
    if (location.startsWith('/admin')) return false;
    if (location.startsWith('/driver')) return false;
    if (location.startsWith('/restaurant')) return false;
    
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
