import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  getUnifiedVerificationState, 
  VerificationBadgeColors,
  type PartnerVerificationInput 
} from "@shared/verification";

interface VerificationBadgeProps {
  verificationInput: PartnerVerificationInput | null | undefined;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}

export function VerificationBadge({ 
  verificationInput, 
  showIcon = true,
  size = 'default' 
}: VerificationBadgeProps) {
  const verification = getUnifiedVerificationState(verificationInput);
  const colors = VerificationBadgeColors[verification.badgeVariant];

  const getIcon = () => {
    if (!showIcon) return null;
    
    const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    
    switch (verification.badgeVariant) {
      case 'verified':
        return <CheckCircle2 className={iconClass} />;
      case 'pending':
        return <Clock className={iconClass} />;
      case 'action_required':
        return <AlertTriangle className={iconClass} />;
      case 'rejected':
        return <XCircle className={iconClass} />;
      default:
        return <ShieldQuestion className={iconClass} />;
    }
  };

  const sizeClasses = size === 'sm' ? 'text-xs py-0.5 px-2' : '';

  return (
    <Badge 
      variant="outline"
      className={`gap-1 ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}`}
      data-testid={`badge-verification-${verification.badgeVariant}`}
    >
      {getIcon()}
      {verification.badgeLabel}
    </Badge>
  );
}
