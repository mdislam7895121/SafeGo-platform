import { useEffect, useState } from "react";
import { Link } from "wouter";
import "@/styles/safego-header.css";

export const SafeGoHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <div className="sg-header-left">
            <Link href="/" className="sg-logo-pill" aria-label="SafeGo home">
              SafeGo
            </Link>

            <nav className="sg-nav" aria-label="Main navigation">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className="sg-nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="sg-auth">
            <Link href="/login" className="sg-login-link" data-testid="button-login">
              Log in
            </Link>
            <Link href="/signup" className="sg-signup-btn" data-testid="button-signup">
              Sign up
            </Link>
          </div>

          <button
            className="sg-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
          >
            <span className={`sg-hamburger-line ${mobileMenuOpen ? "sg-hamburger-line--open-1" : ""}`} />
            <span className={`sg-hamburger-line ${mobileMenuOpen ? "sg-hamburger-line--open-2" : ""}`} />
            <span className={`sg-hamburger-line ${mobileMenuOpen ? "sg-hamburger-line--open-3" : ""}`} />
          </button>
        </div>
      </header>

      <div className={`sg-mobile-menu ${mobileMenuOpen ? "sg-mobile-menu--open" : ""}`}>
        <div className="sg-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
        <div className="sg-mobile-panel">
          <nav className="sg-mobile-nav">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="sg-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="sg-mobile-auth">
            <Link
              href="/login"
              className="sg-mobile-login"
              onClick={() => setMobileMenuOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="sg-mobile-signup"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SafeGoHeader;
