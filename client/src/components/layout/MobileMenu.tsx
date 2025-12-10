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

function MobileLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-sm">S</span>
      </div>
      <span className="font-semibold text-gray-900 text-base">SafeGo</span>
    </div>
  );
}

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
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white"
        style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)" }}
      >
        <Link href="/" onClick={handleNavClick}>
          <MobileLogo />
        </Link>
        <button
          onClick={onClose}
          aria-label="Close menu"
          data-testid="button-mobile-menu-close"
          className="flex items-center justify-center w-11 h-11 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col py-6">
        {/* Navigation Links */}
        <nav aria-label="Mobile navigation" className="flex flex-col">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleNavClick}
              data-testid={`link-mobile-${item.label.toLowerCase()}`}
              className="block px-6 py-5 text-xl font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-6 my-4" />

        {/* Region Selector */}
        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Select Region
          </div>
          <div className="flex flex-wrap gap-2.5">
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => handleRegionSelect(region.id)}
                data-testid={`button-region-${region.id.toLowerCase()}`}
                className={`inline-flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  selectedRegion === region.id
                    ? "bg-gray-900 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {region.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-6 my-4" />

        {/* Auth Section - pushed to bottom */}
        <div className="mt-auto px-6 py-6 flex flex-col gap-3">
          <Link
            href="/login"
            onClick={handleNavClick}
            data-testid="button-mobile-login"
            className="block py-4 text-center text-base font-medium text-gray-900 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={handleNavClick}
            data-testid="button-mobile-signup"
            className="block py-4 text-center text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MobileMenu;
