import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { getPostLoginPath } from "@/lib/roleRedirect";

type AllowedRole = "customer" | "driver" | "restaurant" | "admin" | "ticket_operator" | "shop_partner" | "pending_ticket_operator" | "pending_shop_partner" | "pending_driver" | "pending_restaurant";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AllowedRole[];
}

function LoadingRedirectUI({ message }: { message: string }) {
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      data-testid="protected-route-loading"
    >
      <div style={{ textAlign: 'center' }}>
        <div 
          style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }}
        />
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{message}</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingRedirectUI message="Loading..." />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const targetPath = getPostLoginPath(user);
    return <Redirect to={targetPath || "/login"} />;
  }

  return <>{children}</>;
}
