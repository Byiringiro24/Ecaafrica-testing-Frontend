import { Link } from "@tanstack/react-router";
import { Menu, X, Phone, Instagram, Facebook, Linkedin, Twitter, Mail, Circle } from "lucide-react";
import { useState, ReactNode } from "react";
import { NavLink } from "./NavLink";
import logo from "@/assets/netrack-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/book-demo", label: "Book Demo" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
  { to: "/login", label: "Login" },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FC] text-[#1A1A1A] font-sans antialiased selection:bg-[#42A5F5] selection:text-white relative overflow-x-hidden">

      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-[#42A5F5]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute top-[800px] right-10 w-[600px] h-[600px] bg-gradient-to-br from-[#0A3D91]/5 to-transparent rounded-full blur-[150px] pointer-events-none z-0"></div>

      {/* Top Banner */}
      <div className="bg-[#0A3D91] text-white text-xs font-medium z-50 relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between min-h-[2.5rem] py-1.5 gap-2">
          <span className="opacity-90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
            Empowering African schools with modern cloud technology
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <a href="tel:+250786402913" className="inline-flex items-center gap-2 hover:text-[#42A5F5] transition-colors font-semibold">
              <Phone className="h-3.5 w-3.5" /> +250 786 402 913
            </a>
            <a href="tel:+256773666640" className="inline-flex items-center gap-2 hover:text-[#42A5F5] transition-colors font-semibold">
              <Phone className="h-3.5 w-3.5" /> +256 773 666 640
            </a>
          </div>
        </div>
      </div>

      {/* Header / Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#EEF4FF] shadow-[0_2px_15px_-3px_rgba(10,61,145,0.05)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-4 hover:opacity-95 transition-opacity">
            <div className="bg-[#0A3D91]/5 p-2 rounded-xl border border-[#EEF4FF]">
              <img src={logo} alt="Education Care System Africa by Netrack" className="h-12 w-12 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-xl text-[#0A3D91] tracking-tight">Education Care System</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#5F6B7A]">Africa</div>
            </div>
          </Link>

          {/* Desktop Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `text-sm font-semibold py-2 px-1 relative transition-all duration-200 hover:text-[#0A3D91] ${
                    isActive ? "text-[#0A3D91]" : "text-[#5F6B7A]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{n.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0A3D91] rounded-full"></span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://wa.me/250786402913"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#0A3D91]/15 bg-[#DCFCE7] p-2 text-sm font-semibold text-[#128C7E] hover:bg-[#C8F6D8] transition-colors"
              title="Contact us on WhatsApp"
            >
              <svg viewBox="0 0 448 512" width="20" height="20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M380.9 97.1C339.3 55.5 286.2 32 230.8 32 112.1 32 16 128.1 16 246.8c0 43.4 11.4 85.7 32.9 122.9L0 480l112.5-29.6c35.5 19.4 75.7 29.7 117.5 29.7 118.7 0 214.8-96.1 214.8-214.8 0-55.4-23.5-108.5-65.4-150.2zM230.8 429.4c-36.2 0-71.2-9.7-101.6-28.1l-7.3-4.3-66.7 17.6 17.8-64.9-4.7-7.6c-19.8-31.7-30.1-68.5-30.1-106.7 0-103.2 84-187.2 187.2-187.2 50 0 97 19.5 132.4 55 35.5 35.6 55 82.7 55 132.4-.1 103.2-84.1 187.2-187.3 187.2zm101.8-138.4c-5.6-2.8-33.1-16.4-38.2-18.2-5.1-1.7-8.8-2.8-12.5 2.8-3.7 5.6-14.4 18.2-17.7 22-3.3 3.7-6.6 4.2-12.2 1.4-33.3-16.7-55.1-29.8-77.2-67.8-5.8-10-6.1-14.5-1.7-18.8 4.4-4.4 9.8-11.3 14.7-17 1.6-1.9 2.2-3.3 3.3-5.5 1.1-2.2.6-4.2-.3-5.9-1-1.7-12.5-30.1-17.1-41.2-4.5-10.9-9.1-9.4-12.5-9.6-3.3-.2-7.1-.2-10.8-.2-3.7 0-9.7 1.4-14.8 7-5.1 5.6-19.4 18.9-19.4 46.1 0 27.2 19.8 53.5 22.6 57.2 2.8 3.7 38.9 59.4 94.3 83.5 13.2 5.7 23.5 9.1 31.5 11.7 13.2 4.4 25.2 3.8 34.7 2.3 10.6-1.6 33.1-13.5 37.7-26.5 4.7-13 4.7-24.1 3.3-26.5-1.4-2.4-5.1-3.7-10.7-6.5z" />
              </svg>
            </a>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              className="p-2.5 rounded-xl bg-[#F4F7FC] border border-[#EEF4FF] text-[#0A3D91]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-[#EEF4FF] bg-white shadow-lg">
            <div className="px-4 py-4 flex flex-col gap-2">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  className={({ isActive }) =>
                    `text-sm font-semibold px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-[#0A3D91]/10 text-[#0A3D91]"
                        : "text-[#5F6B7A] hover:text-[#0A3D91] hover:bg-[#F4F7FC]"
                    }`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {n.label}
                </NavLink>
              ))}
              <div className="h-px bg-[#EEF4FF] my-2"></div>
            </div>
          </nav>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 relative z-10 w-full min-w-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#082B66] text-white relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="bg-white p-2.5 rounded-xl border border-white/10 shadow-sm">
                <img src={logo} alt="Education Care System Africa" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <div className="font-display font-bold text-xl text-white">Education Care System</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-[#42A5F5]">Africa</div>
              </div>
            </div>
            <p className="text-sm text-white/80 max-w-md leading-relaxed">
              A premium, configurable SaaS platform built to power African schools from attendance and boarding to fee tracking and parent communication.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-[#42A5F5] tracking-wider uppercase text-xs">Quick Navigation</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className="text-white/70 hover:text-white transition-colors block">Home</Link></li>
              <li><Link to="/features" className="text-white/70 hover:text-white transition-colors block">Features</Link></li>
              <li><Link to="/pricing" className="text-white/70 hover:text-white transition-colors block">Pricing</Link></li>
              <li><Link to="/contact" className="text-white/70 hover:text-white transition-colors block">Contact</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-[#42A5F5] tracking-wider uppercase text-xs">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#42A5F5]" />
                <a href="tel:+250786402913" className="hover:text-white transition-colors">+250 786 402 913</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#42A5F5]" />
                <a href="tel:+256773666640" className="hover:text-white transition-colors">+256 773 666 640</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#42A5F5]" />
                <a href="mailto:Netrackdevelopement@gmail.com" className="hover:text-white transition-colors">Netrackdevelopement@gmail.com</a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-display font-semibold text-[#42A5F5] tracking-wider uppercase text-xs">Follow Us</h4>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/netrack2022", label: "Instagram" },
                { Icon: Facebook, href: "https://www.facebook.com/profile.php?id=100080133396900", label: "Facebook" },
                { Icon: Linkedin, href: "https://linkedin.com/company/92737063/", label: "LinkedIn" },
                { Icon: Twitter, href: "https://x.com/netrack2022", label: "X" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-[#42A5F5] hover:text-white hover:border-[#42A5F5] transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 py-6 bg-[#06204D]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-white/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-center sm:text-left sm:flex-1">
                <span>© 2026 ECA – Education Care Africa. All rights reserved</span>
              </div>
              <div className="text-center sm:flex-1">
                <a href="https://www.netrackgroup.com/" target="_blank" rel="noreferrer" className="text-[#42A5F5] font-semibold hover:underline">
                  Powered by Netrack
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:flex-1 sm:justify-end">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms & Conditions</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
