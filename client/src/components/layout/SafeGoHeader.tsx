import { useEffect, useState } from "react";
import { Link } from "wouter";

export const SafeGoHeader = () => {
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
              padding: "5px 12px",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #0a5cff, #3d8bff)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "15px",
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
            className="hidden md:flex items-center gap-7 flex-1 justify-center"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="relative text-sm font-medium text-gray-800 opacity-85 hover:opacity-100 transition-opacity"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Auth - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-800 opacity-85 hover:opacity-100 transition-opacity"
              data-testid="button-login"
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

          {/* Hamburger - Visible on mobile only */}
          <button
            className="flex md:hidden flex-col justify-center items-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
            style={{
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
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#0f172a",
                borderRadius: "2px",
                transition: "all 250ms ease-out",
                transform: mobileMenuOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#0f172a",
                borderRadius: "2px",
                marginTop: "5px",
                transition: "all 250ms ease-out",
                opacity: mobileMenuOpen ? 0 : 1,
                transform: mobileMenuOpen ? "scaleX(0)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "#0f172a",
                borderRadius: "2px",
                marginTop: "5px",
                transition: "all 250ms ease-out",
                transform: mobileMenuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none",
              }}
            />
          </button>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      <div
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
        className="md:hidden"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: mobileMenuOpen ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0)",
          pointerEvents: mobileMenuOpen ? "auto" : "none",
          transition: "background 250ms ease-out",
        }}
      />

      {/* Mobile Fullscreen Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        className="md:hidden"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 95,
          width: "100%",
          background: "#ffffff",
          transform: mobileMenuOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease-out",
          display: "flex",
          flexDirection: "column",
          paddingTop: "80px",
          overflowY: "auto",
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", padding: "24px 0", flex: 1 }}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: "block",
                padding: "20px 28px",
                fontSize: "18px",
                fontWeight: 500,
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            padding: "24px 28px 40px",
            borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          }}
        >
          <Link
            href="/login"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: "block",
              padding: "16px 0",
              textAlign: "center",
              fontSize: "17px",
              fontWeight: 500,
              color: "#0f172a",
              textDecoration: "none",
              borderRadius: "12px",
              border: "1px solid rgba(0, 0, 0, 0.1)",
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: "block",
              padding: "16px 0",
              textAlign: "center",
              fontSize: "17px",
              fontWeight: 600,
              color: "white",
              background: "#0a5cff",
              borderRadius: "12px",
              textDecoration: "none",
              boxShadow: "0 6px 16px rgba(10, 92, 255, 0.30)",
            }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </>
  );
};

export default SafeGoHeader;
