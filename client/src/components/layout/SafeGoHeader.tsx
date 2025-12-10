import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileMenu } from "./MobileMenu";
import { Menu } from "lucide-react";

type Region = "BD" | "US" | "GLOBAL";

interface SafeGoHeaderProps {
  selectedRegion?: Region;
  onRegionChange?: (region: Region) => void;
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
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            aria-label="SafeGo home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 14px",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #0a5cff, #3d8bff)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "16px",
              letterSpacing: "0.02em",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(10, 92, 255, 0.25)",
              flexShrink: 0,
            }}
          >
            SafeGo
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex"
            style={{
              alignItems: "center",
              gap: "28px",
              flex: 1,
              justifyContent: "center",
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#0f172a",
                  textDecoration: "none",
                  opacity: 0.85,
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth - Hidden on mobile */}
          <div
            className="hidden md:flex"
            style={{
              alignItems: "center",
              gap: "14px",
              flexShrink: 0,
            }}
          >
            <Link
              href="/login"
              data-testid="button-login"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#0f172a",
                textDecoration: "none",
                opacity: 0.85,
              }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              data-testid="button-signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 18px",
                borderRadius: "999px",
                background: "#0a5cff",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 8px 20px rgba(10, 92, 255, 0.35)",
              }}
            >
              Sign up
            </Link>
          </div>

          {/* Hamburger Button - Mobile Only */}
          <button
            className="flex md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginRight: "-8px",
              flexShrink: 0,
            }}
          >
            <Menu size={24} color="#0f172a" />
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

export default SafeGoHeader;
