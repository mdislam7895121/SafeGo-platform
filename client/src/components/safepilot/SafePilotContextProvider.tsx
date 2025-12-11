import { createContext, useContext, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  getContextDefinition, 
  getPageKeyFromPath, 
  FALLBACK_CONTEXT,
  type SafePilotContextDefinition 
} from './contextRegistry';

export interface SafePilotContextData {
  pageKey: string;
  pageName: string;
  description: string;
  category: string;
  metrics: Record<string, number | string>;
  actions: Array<{
    key: string;
    label: string;
    actionType: string;
    payload: Record<string, unknown>;
  }>;
  risks: Array<{
    type: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  isLoading: boolean;
  error: string | null;
}

export interface SafePilotContextValue {
  context: SafePilotContextData;
  definition: SafePilotContextDefinition;
  pageKey: string;
  refetch: () => void;
}

const DEFAULT_CONTEXT_DATA: SafePilotContextData = {
  pageKey: 'admin.unknown',
  pageName: 'Unknown',
  description: 'No specific context available',
  category: 'dashboard',
  metrics: {},
  actions: [],
  risks: [],
  alerts: [],
  isLoading: false,
  error: null,
};

const SafePilotContext = createContext<SafePilotContextValue>({
  context: DEFAULT_CONTEXT_DATA,
  definition: FALLBACK_CONTEXT,
  pageKey: 'admin.unknown',
  refetch: () => {},
});

export function SafePilotContextProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  
  const pageKey = useMemo(() => {
    if (!location.startsWith('/admin')) {
      return 'admin.dashboard';
    }
    return getPageKeyFromPath(location);
  }, [location]);
  
  const definition = useMemo(() => getContextDefinition(pageKey), [pageKey]);
  
  const { data, isLoading, error, refetch } = useQuery<SafePilotContextData>({
    queryKey: ['/api/admin/safepilot/context', pageKey],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ pageKey });
        const res = await fetch(`/api/admin/safepilot/context?${params}`, {
          credentials: 'include',
        });
        
        if (!res.ok) {
          return {
            ...DEFAULT_CONTEXT_DATA,
            pageKey,
            pageName: definition.pageName,
            description: definition.description,
            category: definition.category,
            error: 'Failed to load context',
          };
        }
        
        const data = await res.json();
        
        return {
          pageKey: data.pageKey || pageKey,
          pageName: data.summary?.title || definition.pageName,
          description: data.summary?.description || definition.description,
          category: definition.category,
          metrics: data.metrics || {},
          actions: data.quickActions || [],
          risks: data.alerts?.filter((a: any) => a.severity === 'HIGH' || a.severity === 'CRITICAL') || [],
          alerts: data.alerts || [],
          isLoading: false,
          error: null,
        };
      } catch (err) {
        return {
          ...DEFAULT_CONTEXT_DATA,
          pageKey,
          pageName: definition.pageName,
          description: definition.description,
          category: definition.category,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    enabled: location.startsWith('/admin'),
    staleTime: 30 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
  
  const context = useMemo<SafePilotContextData>(() => {
    if (isLoading) {
      return {
        ...DEFAULT_CONTEXT_DATA,
        pageKey,
        pageName: definition.pageName,
        description: definition.description,
        category: definition.category,
        isLoading: true,
      };
    }
    
    if (error || !data) {
      return {
        ...DEFAULT_CONTEXT_DATA,
        pageKey,
        pageName: definition.pageName,
        description: definition.description,
        category: definition.category,
        error: error instanceof Error ? error.message : 'Failed to load context',
      };
    }
    
    return data;
  }, [data, isLoading, error, pageKey, definition]);
  
  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);
  
  const value = useMemo<SafePilotContextValue>(() => ({
    context,
    definition,
    pageKey,
    refetch: handleRefetch,
  }), [context, definition, pageKey, handleRefetch]);
  
  return (
    <SafePilotContext.Provider value={value}>
      {children}
    </SafePilotContext.Provider>
  );
}

export function useSafePilotContext() {
  const context = useContext(SafePilotContext);
  if (!context) {
    return {
      context: DEFAULT_CONTEXT_DATA,
      definition: FALLBACK_CONTEXT,
      pageKey: 'admin.unknown',
      refetch: () => {},
    };
  }
  return context;
}

export function useSafePilotActions() {
  const { context } = useSafePilotContext();
  return context.actions;
}

export function useSafePilotRisks() {
  const { context } = useSafePilotContext();
  return context.risks;
}

export function useSafePilotMetrics() {
  const { context } = useSafePilotContext();
  return context.metrics;
}
