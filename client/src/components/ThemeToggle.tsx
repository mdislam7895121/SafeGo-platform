import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
          <Button variant="ghost" size="icon" className={className} data-testid="button-theme-toggle">
            {theme === "system" ? (
              <Monitor className="h-5 w-5" />
            ) : resolvedTheme === "dark" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => setTheme("light")} 
            className={theme === "light" ? "bg-accent" : ""}
            data-testid="menu-theme-light"
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
            {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("dark")}
            className={theme === "dark" ? "bg-accent" : ""}
            data-testid="menu-theme-dark"
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
            {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme("system")}
            className={theme === "system" ? "bg-accent" : ""}
            data-testid="menu-theme-system"
          >
            <Monitor className="mr-2 h-4 w-4" />
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
      className={className}
      data-testid="button-theme-toggle"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
