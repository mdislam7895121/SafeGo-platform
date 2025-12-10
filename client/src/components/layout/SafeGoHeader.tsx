import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SafeGoMobileMenu } from "./SafeGoMobileMenu";
import "@/styles/safego-header.css";

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
      <header className={`sg-header ${isScrolled ? "sg-header--scrolled" : ""}`}>
        <div className="sg-header-inner">
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

          <div className="sg-auth">
            <Link href="/login" className="sg-login-link" data-testid="button-login">
              Log in
            </Link>
            <Link href="/signup" className="sg-signup-btn" data-testid="button-signup">
              Sign up
            </Link>
          </div>

          <button
            className="sg-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            data-testid="button-mobile-menu"
          >
            <span className={`sg-hamburger-bar ${mobileMenuOpen ? "sg-hamburger-bar--open-1" : ""}`} />
            <span className={`sg-hamburger-bar ${mobileMenuOpen ? "sg-hamburger-bar--open-2" : ""}`} />
            <span className={`sg-hamburger-bar ${mobileMenuOpen ? "sg-hamburger-bar--open-3" : ""}`} />
          </button>
        </div>
      </header>

      <SafeGoMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
};

export default SafeGoHeader;
