import React, { useState } from 'react';

/**
 * Navbar / Navigation Component
 * Features:
 * 1. Desktop View: Visible navigation links on desktop, hidden on mobile screens (hidden md:flex).
 * 2. Mobile View: Hamburger menu icon button with two horizontal lines, visible only on mobile (flex md:hidden).
 * 3. State Management: React state `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)` to handle toggle action.
 * 4. Dropdown/Menu: Mobile-friendly dropdown/slide-out menu rendered when `isMobileMenuOpen` is true with all navigation links.
 * 5. Icon Toggle: Two horizontal lines icon toggles to a Close (X) icon when open; menu closes on link click.
 */
export const Navbar = () => {
  // 3. State Management: React state to handle mobile menu toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navigation Links
  const navLinks = [
    { label: 'The 3D Vision', href: '#hero-scroll-section' },
    { label: 'Exclusive Portfolio', href: '#properties-showcase-section' },
    { label: 'Interactive Map', href: '#interactive-map-section' },
    { label: 'Certification & About', href: '#about-us-section' },
    { label: 'Why RETHA', href: '#why-retha-section' },
    { label: 'Contact', href: '#contact-footer' },
  ];

  return (
    <nav className="site-nav-header relative w-full bg-black/80 backdrop-blur-md border-b border-[#D4AF37]/20 z-50">
      <div className="nav-container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand Logo & Monogram */}
        <a href="#hero-scroll-section" className="brand-logo flex items-center gap-3 text-white no-underline">
          <div className="logo-monogram-box w-9 h-9 rounded-lg border border-[#D4AF37]/40 flex items-center justify-center bg-stone-900 shadow-md">
            <span className="monogram-letter font-serif font-bold text-[#F4D375] text-xl">R</span>
          </div>
          <div className="logo-text-block flex flex-col">
            <span className="brand-name font-serif font-bold tracking-widest text-lg text-white">RETHA</span>
            <span className="brand-tagline text-[10px] tracking-widest text-[#D4AF37] uppercase">REAL ESTATE • ريثا</span>
          </div>
        </a>

        {/* 1. Desktop View: Keep existing navigation links visible on desktop, hidden on mobile */}
        <div className="main-nav hidden md:flex items-center gap-6">
          <ul className="nav-menu flex items-center gap-6 list-none m-0 p-0">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="nav-link text-sm font-medium text-white/80 hover:text-[#F4D375] transition-colors py-1 relative"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions & Mobile Menu Toggle */}
        <div className="header-actions flex items-center gap-3">
          {/* Direct Phone Dial Link */}
          <a
            href="tel:+9660502125573"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-[#F4D375] transition-colors no-underline"
            title="Call RETHA Real Estate: +966 0502125573"
          >
            <span>✆</span>
            <span>+966 0502125573</span>
          </a>

          {/* VIP Consultation CTA */}
          <a
            href="#schedule-viewing-modal"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#9E7D19] text-black hover:opacity-90 transition-opacity"
          >
            <span>VIP Advisory</span>
            <span>→</span>
          </a>

          {/* 2. Mobile View: Hamburger menu icon button (three horizontal lines) strictly hidden on desktop and only visible on mobile (flex md:hidden) */}
          <button
            type="button"
            className="mobile-menu-btn hamburger-menu-btn flex md:hidden items-center justify-center w-10 h-10 rounded-lg border border-[#D4AF37]/30 bg-white/5 text-white hover:text-[#F4D375] hover:bg-[#D4AF37]/10 focus:outline-none transition-all cursor-pointer"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {/* 5. Icon Toggle: Hamburger with three horizontal lines when closed, Close (X) icon when open */}
            {isMobileMenuOpen ? (
              // Close (X) Icon
              <svg
                className="w-6 h-6 text-white stroke-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" />
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" />
              </svg>
            ) : (
              // Hamburger menu icon button with THREE HORIZONTAL LINES
              <svg
                className="w-6 h-6 text-white stroke-white hamburger-three-lines-icon hamburger-two-lines-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" />
                <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" />
                <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 4. Dropdown/Menu: When state is true, display mobile-friendly dropdown or slide-out menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-dropdown"
          className="mobile-nav-dropdown md:hidden absolute top-full left-0 w-full bg-[#0A0B0E]/95 backdrop-blur-xl border-b border-[#D4AF37]/30 shadow-2xl transition-all duration-300"
        >
          <div className="mobile-nav-inner px-6 py-6 flex flex-col gap-4">
            <ul className="mobile-nav-menu flex flex-col gap-2 list-none m-0 p-0">
              {navLinks.map((link, idx) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    // 5. Ensure the menu closes when a link is clicked
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="mobile-nav-link flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium text-white/90 bg-white/5 border border-white/5 hover:bg-[#D4AF37]/15 hover:border-[#D4AF37]/40 hover:text-[#F4D375] transition-all"
                  >
                    <span>{link.label}</span>
                    <span className="text-xs text-[#D4AF37] font-serif">0{idx + 1} ↗</span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="mobile-nav-cta pt-4 border-t border-white/10 flex flex-col gap-3">
              <a
                href="#schedule-viewing-modal"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-3 rounded-lg text-center text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#9E7D19] text-black shadow-lg"
              >
                VIP Private Acquisition Advisory →
              </a>
              <div className="text-center text-xs text-white/50 tracking-wider">
                <a
                  href="tel:+9660502125573"
                  className="hover:text-[#F4D375] transition-colors text-inherit no-underline"
                  title="Call RETHA Real Estate: +966 0502125573"
                >
                  ✆ +966 0502125573
                </a>{' '}
                • شركة ريثا العقارية
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
