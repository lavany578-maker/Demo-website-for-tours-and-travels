import { useEffect, useState } from 'react';
import { ArrowUp, CalendarCheck, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../lib/api.ts';
import type { SiteSettings } from '../types/travel.ts';

interface FloatingWidgetsProps {
  settings: SiteSettings;
  onBookClick: () => void;
  onContactClick: () => void;
  showMobileSticky: boolean;
}

export function FloatingWidgets({
  settings,
  onBookClick,
  onContactClick,
  showMobileSticky,
}: FloatingWidgetsProps) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 480);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const whatsappUrl = buildWhatsAppUrl(
    settings.whatsapp,
    `Namaste ${settings.businessName}! I would like details about your upcoming tour packages.`
  );

  return (
    <>
      {/* Desktop/Tablet Bottom-Right Floating Action Controls */}
      <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-30 flex flex-col items-end gap-2.5">
        {showTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="w-11 h-11 rounded-full bg-white text-[#0B1F3A] border border-slate-200 shadow-lg hover:bg-slate-100 flex items-center justify-center transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xl transition-transform hover:-translate-y-0.5"
          >
            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">WhatsApp Support</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={onContactClick}
            aria-label="Contact tour operator"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xl transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Tour Desk</span>
          </button>
        )}
      </div>

      {/* Compact Mobile Sticky Booking Bar (<15% mobile height) */}
      {showMobileSticky && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0B1F3A]/95 backdrop-blur-md border-t border-white/15 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="text-white min-w-0">
            <div className="text-xs font-semibold truncate">Aai Ekveera Mauli</div>
            <div className="text-[11px] text-amber-300 truncate">Enquiries Open</div>
          </div>
          <button
            type="button"
            onClick={onBookClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0B1F3A] bg-amber-400 hover:bg-amber-300 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Book Trip
          </button>
        </div>
      )}
    </>
  );
}
