import { Link } from "wouter";
import { X } from "lucide-react";

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
      className="md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
      aria-hidden={!isOpen}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        width: "100vw",
        height: "100vh",
        background: "#ffffff",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Header with Logo and Close */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        }}
      >
        <Link
          href="/"
          onClick={handleNavClick}
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
          }}
        >
          SafeGo
        </Link>
        <button
          onClick={onClose}
          aria-label="Close menu"
          data-testid="button-mobile-menu-close"
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
            borderRadius: "12px",
          }}
        >
          <X size={24} color="#0f172a" />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 0" }}>
        {/* Navigation Links */}
        <nav aria-label="Mobile navigation" style={{ display: "flex", flexDirection: "column" }}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleNavClick}
              data-testid={`link-mobile-${item.label.toLowerCase()}`}
              style={{
                display: "block",
                padding: "20px 24px",
                fontSize: "22px",
                fontWeight: 500,
                color: "#0f172a",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(0, 0, 0, 0.08)", margin: "16px 24px" }} />

        {/* Region Selector */}
        <div style={{ padding: "16px 24px 24px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "12px",
            }}
          >
            Select Region
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => handleRegionSelect(region.id)}
                data-testid={`button-region-${region.id.toLowerCase()}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 18px",
                  borderRadius: "999px",
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 180ms ease-out",
                  background: selectedRegion === region.id ? "#0f172a" : "#f1f5f9",
                  color: selectedRegion === region.id ? "#ffffff" : "#475569",
                  boxShadow: selectedRegion === region.id ? "0 4px 12px rgba(15, 23, 42, 0.25)" : "none",
                }}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(0, 0, 0, 0.08)", margin: "0 24px 16px" }} />

        {/* Auth Section */}
        <div
          style={{
            padding: "24px",
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <Link
            href="/login"
            onClick={handleNavClick}
            data-testid="button-mobile-login"
            style={{
              display: "block",
              padding: "16px 0",
              textAlign: "center",
              fontSize: "17px",
              fontWeight: 500,
              color: "#0f172a",
              textDecoration: "none",
              borderRadius: "12px",
              border: "1px solid rgba(0, 0, 0, 0.12)",
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={handleNavClick}
            data-testid="button-mobile-signup"
            style={{
              display: "block",
              padding: "16px 0",
              textAlign: "center",
              fontSize: "17px",
              fontWeight: 600,
              color: "#ffffff",
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
    </div>
  );
}

export default MobileMenu;
