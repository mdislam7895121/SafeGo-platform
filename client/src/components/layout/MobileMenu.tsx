import { Link } from "wouter";
import { X } from "lucide-react";
import "@/styles/mobile-menu.css";

type Region = "BD" | "US" | "GLOBAL";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion: Region;
  onRegionChange: (region: Region) => void;
}

const navItems = [
  { label: "Ride", href: "/ride" },
  { label: "Drive", href: "/drive" },
  { label: "Business", href: "/business" },
  { label: "Safety", href: "/safety" },
];

const regions: { id: Region; label: string }[] = [
  { id: "BD", label: "Bangladesh" },
  { id: "US", label: "United States" },
  { id: "GLOBAL", label: "Global" },
];

export function MobileMenu({ isOpen, onClose, selectedRegion, onRegionChange }: MobileMenuProps) {
  const handleRegionSelect = (regionId: Region) => {
    onRegionChange(regionId);
  };

  const handleNavClick = () => {
    onClose();
  };

  return (
    <div
      className={`sg-mobile-overlay ${isOpen ? "sg-mobile-overlay--open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
      aria-hidden={!isOpen}
    >
      {/* Header with Logo and Close */}
      <div className="sg-mobile-header">
        <Link href="/" className="sg-mobile-logo" onClick={handleNavClick}>
          SafeGo
        </Link>
        <button
          className="sg-mobile-close"
          onClick={onClose}
          aria-label="Close menu"
          data-testid="button-mobile-menu-close"
        >
          <X />
        </button>
      </div>

      {/* Content */}
      <div className="sg-mobile-content">
        {/* Navigation Links */}
        <nav className="sg-mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="sg-mobile-nav-link"
              onClick={handleNavClick}
              data-testid={`link-mobile-${item.label.toLowerCase()}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="sg-mobile-divider" />

        {/* Region Selector */}
        <div className="sg-mobile-region-section">
          <div className="sg-mobile-region-label">Select Region</div>
          <div className="sg-mobile-region-pills">
            {regions.map((region) => (
              <button
                key={region.id}
                className={`sg-mobile-region-pill ${selectedRegion === region.id ? "sg-mobile-region-pill--active" : ""}`}
                onClick={() => handleRegionSelect(region.id)}
                data-testid={`button-region-${region.id.toLowerCase()}`}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="sg-mobile-divider" />

        {/* Auth Section */}
        <div className="sg-mobile-auth">
          <Link
            href="/login"
            className="sg-mobile-login-btn"
            onClick={handleNavClick}
            data-testid="button-mobile-login"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="sg-mobile-signup-btn"
            onClick={handleNavClick}
            data-testid="button-mobile-signup"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MobileMenu;
