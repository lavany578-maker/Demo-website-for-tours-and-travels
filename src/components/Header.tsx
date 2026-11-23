import { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  activeView: 'home' | 'admin' | 'enquiry-action' | 'not-found';
  onNavigateHome: (sectionId?: string) => void;
  onOpenAdmin: () => void;
  onOpenEnquiry: () => void;
}

export function Header({ activeView, onNavigateHome, onOpenAdmin, onOpenEnquiry }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigateHome(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Title */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
            onNavigateHome();
          }}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded"
        >
          Aai Ekveera Mauli
        </a>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => handleSectionClick('packages')}
            className="hover:text-[#0B1F3A] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-amber-500 cursor-pointer"
          >
            Packages
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('calculator')}
            className="hover:text-[#0B1F3A] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-amber-500 cursor-pointer"
          >
            Cost Estimator
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('instagram')}
            className="hover:text-[#0B1F3A] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-amber-500 cursor-pointer"
          >
            Gallery
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('contact')}
            className="hover:text-[#0B1F3A] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-amber-500 cursor-pointer"
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAdmin();
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeView === 'admin'
                ? 'text-[#0B1F3A] border-amber-500 font-semibold'
                : 'hover:text-[#0B1F3A] border-transparent hover:border-amber-500'
            }`}
          >
            Admin
          </button>
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenEnquiry();
            }}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Book Enquiry
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2 shadow-lg">
          <button
            type="button"
            onClick={() => handleSectionClick('packages')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Packages
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('calculator')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cost Estimator
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('instagram')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Gallery
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('contact')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAdmin();
            }}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Admin Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenEnquiry();
            }}
            className="block w-full text-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C]"
          >
            Book Enquiry
          </button>
        </div>
      )}
    </header>
  );
}
