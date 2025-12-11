import { Link } from "wouter";

interface SafeGoMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafeGoMobileMenu = ({ isOpen, onClose }: SafeGoMobileMenuProps) => {
  const navItems = [
    { label: "Ride", href: "/ride" },
    { label: "Drive", href: "/drive" },
    { label: "Business", href: "/business" },
    { label: "Safety", href: "/safety" },
  ];

  return (
    <>
      <div 
        className={`sg-drawer-backdrop ${isOpen ? "sg-drawer-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={`sg-drawer ${isOpen ? "sg-drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <nav className="sg-drawer-nav">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="sg-drawer-link"
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sg-drawer-auth">
          <Link href="/login" className="sg-drawer-login" onClick={onClose}>
            Log in
          </Link>
          <Link href="/signup" className="sg-drawer-signup" onClick={onClose}>
            Sign up
          </Link>
        </div>
      </div>
    </>
  );
};

export default SafeGoMobileMenu;
