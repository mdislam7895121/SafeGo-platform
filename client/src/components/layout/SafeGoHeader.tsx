import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileMenu } from "./MobileMenu";
import { Menu } from "lucide-react";

type Region = "BD" | "US" | "GLOBAL";

interface SafeGoHeaderProps {
  selectedRegion?: Region;
  onRegionChange?: (region: Region) => void;
}

function SafeGoLogo({ size = "default" }: { size?: "default" | "small" }) {
  const iconSize = size === "small" ? "h-7 w-7" : "h-8 w-8";
  const fontSize = size === "small" ? "text-base" : "text-lg";
  
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} rounded-lg bg-blue-600 flex items-center justify-center shadow-sm`}>
        <span className="text-white font-bold">S</span>
      </div>
      <span className={`font-semibold text-gray-900 dark:text-white ${fontSize}`}>SafeGo</span>
    </div>
  );
}

export const SafeGoHeader = ({ selectedRegion = "BD", onRegionChange }: SafeGoHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 5);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleRegionChange = (region: Region) => {
    onRegionChange?.(region);
  };

  const navItems = [
    { label: "Ride", href: "/ride" },
    { label: "Drive", href: "/drive" },
    { label: "Business", href: "/business" },
    { label: "Safety", href: "/safety" },
  ];

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          width: "100%",
          backdropFilter: isScrolled ? "blur(16px)" : "blur(12px)",
          WebkitBackdropFilter: isScrolled ? "blur(16px)" : "blur(12px)",
          background: isScrolled ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.85)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
          boxShadow: isScrolled ? "0 4px 18px rgba(0, 0, 0, 0.08)" : "none",
          transition: "all 180ms ease-out",
        }}
      >
        <div
          className="max-w-[1200px] mx-auto px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-6"
        >
          {/* Logo - matches footer design */}
          <Link href="/" aria-label="SafeGo home" className="flex-shrink-0">
            <SafeGoLogo size="default" />
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-7 flex-1 justify-center"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            <Link
              href="/login"
              data-testid="button-login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              data-testid="button-signup"
              className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
            >
              Sign up
            </Link>
          </div>

          {/* Hamburger Button - Mobile Only */}
          <button
            className="flex md:hidden items-center justify-center w-11 h-11 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
          >
            <Menu size={24} className="text-gray-700" />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        selectedRegion={selectedRegion}
        onRegionChange={handleRegionChange}
      />
    </>
  );
};

export { SafeGoLogo };
export default SafeGoHeader;
