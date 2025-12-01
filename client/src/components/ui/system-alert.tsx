import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react"

const systemAlertVariants = cva(
  "relative w-full rounded-xl border p-4 transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-100",
        success: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/50 dark:border-green-800 dark:text-green-100",
        warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-100",
        danger: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
}

const iconColorMap = {
  info: "text-blue-600 dark:text-blue-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
}

interface SystemAlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof systemAlertVariants> {
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
  action?: React.ReactNode
}

const SystemAlert = React.forwardRef<HTMLDivElement, SystemAlertProps>(
  (
    {
      className,
      variant = "info",
      title,
      children,
      dismissible = false,
      onDismiss,
      icon,
      action,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(true)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)

    const handleDismiss = React.useCallback(() => {
      setIsAnimatingOut(true)
      setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, 200)
    }, [onDismiss])

    if (!isVisible) return null

    const IconComponent = iconMap[variant || "info"]
    const iconColor = iconColorMap[variant || "info"]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          systemAlertVariants({ variant }),
          isAnimatingOut && "opacity-0 scale-95 -translate-y-2",
          className
        )}
        data-testid={`alert-${variant}`}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div className={cn("shrink-0 mt-0.5", iconColor)}>
            {icon || <IconComponent className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="font-semibold text-sm mb-1" data-testid={`alert-title-${variant}`}>
                {title}
              </h5>
            )}
            {children && (
              <div className="text-sm opacity-90" data-testid={`alert-description-${variant}`}>
                {children}
              </div>
            )}
            {action && <div className="mt-3">{action}</div>}
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-colors",
                "hover:bg-black/5 dark:hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-offset-2",
                variant === "info" && "focus:ring-blue-500",
                variant === "success" && "focus:ring-green-500",
                variant === "warning" && "focus:ring-amber-500",
                variant === "danger" && "focus:ring-red-500"
              )}
              aria-label="Dismiss alert"
              data-testid={`button-dismiss-alert-${variant}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
SystemAlert.displayName = "SystemAlert"

interface SystemAlertBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof systemAlertVariants> {
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
  action?: React.ReactNode
}

const bannerVariants = cva(
  "w-full px-4 py-3 transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        info: "bg-blue-600 text-white dark:bg-blue-700",
        success: "bg-green-600 text-white dark:bg-green-700",
        warning: "bg-amber-500 text-white dark:bg-amber-600",
        danger: "bg-red-600 text-white dark:bg-red-700",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const SystemAlertBanner = React.forwardRef<HTMLDivElement, SystemAlertBannerProps>(
  (
    {
      className,
      variant = "info",
      children,
      dismissible = false,
      onDismiss,
      icon,
      action,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(true)
    const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)

    const handleDismiss = React.useCallback(() => {
      setIsAnimatingOut(true)
      setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, 200)
    }, [onDismiss])

    if (!isVisible) return null

    const IconComponent = iconMap[variant || "info"]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          bannerVariants({ variant }),
          isAnimatingOut && "opacity-0 -translate-y-3",
          className
        )}
        data-testid={`banner-${variant}`}
        {...props}
      >
        <div className="flex items-center justify-center gap-3 max-w-7xl mx-auto">
          <div className="shrink-0">
            {icon || <IconComponent className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="flex-1 text-sm font-medium text-center sm:text-left">
            {children}
          </div>
          {action && <div className="shrink-0">{action}</div>}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Dismiss banner"
              data-testid={`button-dismiss-banner-${variant}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
SystemAlertBanner.displayName = "SystemAlertBanner"

interface AlertStackProps {
  children: React.ReactNode
  className?: string
}

const AlertStack = ({ children, className }: AlertStackProps) => (
  <div className={cn("space-y-3", className)} data-testid="alert-stack">
    {children}
  </div>
)
AlertStack.displayName = "AlertStack"

export { SystemAlert, SystemAlertBanner, AlertStack, systemAlertVariants }
