import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Instagram, Facebook, Linkedin, Twitter, MessageSquare } from "lucide-react";
import { useState, ReactNode } from "react";
import { NavLink } from "./NavLink";
import logo from "@/assets/netrack-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
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
              <Phone className="h-3.5 w-3.5" /> +250 786402913
            </a>
            <a href="tel:+256773666640" className="inline-flex items-center gap-2 hover:text-[#42A5F5] transition-colors font-semibold">
              <Phone className="h-3.5 w-3.5" /> +256 773666640
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
              className="inline-flex items-center gap-2 rounded-full border border-[#0A3D91]/15 bg-[#DCFCE7] px-3 py-2 text-sm font-semibold text-[#0A3D91] hover:bg-[#C8F6D8] transition-colors"
            >
              <MessageSquare className="h-4 w-4" /> WhatsApp
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
      <main className="flex-1 relative z-10 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#082B66] text-white mt-16 relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-4 gap-12">

          {/* Brand Info */}
          <div className="md:col-span-2 space-y-6">
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
              A premium, configurable multi-tenant SaaS platform built to power African schools from attendance, boarding, fee tracking, to parent communication.
            </p>
            <Button className="bg-[#42A5F5] hover:bg-[#42A5F5]/90 text-white rounded-xl shadow-md h-10 px-5 font-semibold text-xs transition-all hover:scale-[1.02]" asChild>
              <Link to="/contact">Request a Demo</Link>
            </Button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-[#42A5F5] tracking-wider uppercase text-xs">Quick Navigation</h4>
            <ul className="space-y-2.5 text-sm">
              {nav.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="text-white/70 hover:text-white hover:underline transition-all block">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-[#42A5F5] tracking-wider uppercase text-xs">Contact Us</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li>+250 786 378 333</li>
              <li>+250 725 931 731</li>
              <li>Netrackdevelopement@gmail.com</li>
            </ul>
          </div>
        </div>

        {/* Copyright bar */}
        <div className="border-t border-white/10 py-6 bg-[#06204D]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-xs text-white/60">
            <span className="text-center sm:text-left">© 2026 ECA – Education Care Africa. All rights reserved.</span>
            <span className="text-center order-first sm:order-none font-medium">
              Powered by{" "}
              <a href="https://www.netrackgroup.com/" target="_blank" rel="noreferrer" className="text-[#42A5F5] font-semibold hover:underline">
                Netrack
              </a>
            </span>
            <div className="flex items-center gap-3 justify-center sm:justify-end">
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
                  className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:bg-[#42A5F5] hover:text-white hover:border-[#42A5F5] transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
