import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "dropdown";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 h-11 w-11 sm:h-9 sm:w-9",
              "transition-colors duration-200",
              className
            )} 
            data-testid="button-theme-toggle"
          >
            {theme === "system" ? (
              <Monitor className="h-5 w-5 text-foreground" />
            ) : resolvedTheme === "dark" ? (
              <Moon className="h-5 w-5 text-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-foreground" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem 
            onClick={() => setTheme("light")} 
            className={cn(
              "min-h-[44px] sm:min-h-[32px] cursor-pointer",
              theme === "light" && "bg-accent"
            )}
            data-testid="menu-theme-light"
          >
            <Sun className="mr-2 h-4 w-4 text-amber-500" />
            Light
            {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("dark")}
            className={cn(
              "min-h-[44px] sm:min-h-[32px] cursor-pointer",
              theme === "dark" && "bg-accent"
            )}
            data-testid="menu-theme-dark"
          >
            <Moon className="mr-2 h-4 w-4 text-blue-400" />
            Dark
            {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("system")}
            className={cn(
              "min-h-[44px] sm:min-h-[32px] cursor-pointer",
              theme === "system" && "bg-accent"
            )}
            data-testid="menu-theme-system"
          >
            <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
            System
            {theme === "system" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 h-11 w-11 sm:h-9 sm:w-9",
        "transition-colors duration-200",
        className
      )}
      data-testid="button-theme-toggle"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-amber-400" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
