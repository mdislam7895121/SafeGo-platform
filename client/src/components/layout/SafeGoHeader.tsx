import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileMenu } from "./MobileMenu";
import "@/styles/safego-header.css";

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
      <header className={`sg-header ${isScrolled ? "sg-header--scrolled" : ""}`}>
        <div className="sg-header-inner">
          {/* Logo */}
          <Link href="/" className="sg-logo-pill" aria-label="SafeGo home">
            SafeGo
          </Link>

          {/* Desktop Navigation */}
          <nav className="sg-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="sg-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="sg-auth">
            <Link href="/login" className="sg-login-link" data-testid="button-login">
              Log in
            </Link>
            <Link href="/signup" className="sg-signup-btn" data-testid="button-signup">
              Sign up
            </Link>
          </div>

          {/* Hamburger Button - Mobile Only */}
          <button
            className="sg-hamburger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
          >
            <span className="sg-hamburger-bar" />
            <span className="sg-hamburger-bar" />
            <span className="sg-hamburger-bar" />
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
