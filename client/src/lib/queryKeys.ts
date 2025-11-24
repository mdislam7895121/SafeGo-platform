/**
 * Query key factories for consistent cache management
 * Following React Query best practices: https://tkdodo.eu/blog/effective-react-query-keys
 */

export const ordersKeys = {
  all: ['/api/restaurant/orders'] as const,
  lists: () => [...ordersKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...ordersKeys.lists(), filters] as const,
  details: () => [...ordersKeys.all, 'detail'] as const,
  detail: (id: string) => [...ordersKeys.details(), id] as const,
  live: () => [...ordersKeys.all, 'live'] as const,
  overview: () => [...ordersKeys.all, 'overview'] as const,
};

export const restaurantKeys = {
  home: ['/api/restaurant/home'] as const,
  wallet: ['/api/restaurant/wallet'] as const,
};
