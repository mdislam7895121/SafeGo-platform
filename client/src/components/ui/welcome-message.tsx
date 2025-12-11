import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Sparkles, ArrowRight } from "lucide-react"

interface WelcomeMessageProps {
  title?: string
  message?: string
  ctaText?: string
  ctaHref?: string
  onDismiss?: () => void
  onCtaClick?: () => void
  showDismiss?: boolean
  variant?: "default" | "primary" | "gradient"
  icon?: React.ReactNode
  className?: string
  storageKey?: string
}

const STORAGE_PREFIX = "safego_welcome_dismissed_"

export function WelcomeMessage({
  title = "Welcome to SafeGo!",
  message = "We're glad to have you here. Get started by exploring the dashboard.",
  ctaText,
  ctaHref,
  onDismiss,
  onCtaClick,
  showDismiss = true,
  variant = "default",
  icon,
  className,
  storageKey = "default",
}: WelcomeMessageProps) {
  const [isVisible, setIsVisible] = React.useState(true)
  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false)

  React.useEffect(() => {
    const dismissed = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`)
    if (dismissed === "true") {
      setIsVisible(false)
    }
  }, [storageKey])

  const handleDismiss = React.useCallback(() => {
    setIsAnimatingOut(true)
    setTimeout(() => {
      setIsVisible(false)
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, "true")
      onDismiss?.()
    }, 300)
  }, [storageKey, onDismiss])

  const handleCtaClick = React.useCallback(() => {
    if (ctaHref) {
      window.location.href = ctaHref
    }
    onCtaClick?.()
  }, [ctaHref, onCtaClick])

  if (!isVisible) return null

  const variantStyles = {
    default: "bg-card border",
    primary: "bg-primary text-primary-foreground border-0",
    gradient: "bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground border-0",
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 ease-out",
        variantStyles[variant],
        isAnimatingOut && "opacity-0 scale-95 -translate-y-2",
        className
      )}
      data-testid="welcome-message"
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className={cn(
              "shrink-0 p-2.5 rounded-xl",
              variant === "default" ? "bg-primary/10 text-primary" : "bg-white/20 text-white"
            )}>
              {icon}
            </div>
          ) : (
            <div className={cn(
              "shrink-0 p-2.5 rounded-xl",
              variant === "default" ? "bg-primary/10 text-primary" : "bg-white/20 text-white"
            )}>
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          )}
          
          <div className="flex-1 min-w-0 space-y-2">
            <h3 
              className={cn(
                "font-semibold text-base sm:text-lg",
                variant === "default" ? "text-foreground" : "text-inherit"
              )}
              data-testid="welcome-title"
            >
              {title}
            </h3>
            <p 
              className={cn(
                "text-sm sm:text-base",
                variant === "default" ? "text-muted-foreground" : "opacity-90"
              )}
              data-testid="welcome-message-text"
            >
              {message}
            </p>
            
            {ctaText && (
              <div className="pt-2">
                <Button
                  variant={variant === "default" ? "default" : "secondary"}
                  size="sm"
                  onClick={handleCtaClick}
                  className="gap-1.5"
                  data-testid="button-welcome-cta"
                >
                  {ctaText}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {showDismiss && (
            <button
              onClick={handleDismiss}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-colors",
                variant === "default" 
                  ? "hover:bg-muted focus:ring-primary" 
                  : "hover:bg-white/20 focus:ring-white/50",
                "focus:outline-none focus:ring-2 focus:ring-offset-2"
              )}
              aria-label="Dismiss welcome message"
              data-testid="button-dismiss-welcome"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </CardContent>
      
      {variant === "gradient" && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      )}
    </Card>
  )
}

export function resetWelcomeMessage(storageKey: string = "default") {
  localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`)
}

export function isWelcomeDismissed(storageKey: string = "default"): boolean {
  return localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`) === "true"
}
