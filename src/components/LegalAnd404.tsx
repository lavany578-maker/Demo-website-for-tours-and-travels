import { Compass, X } from 'lucide-react';
import type { SiteSettings } from '../types/travel.ts';

export type LegalDocType = 'privacy' | 'terms' | 'cancellation' | null;

export function LegalModal({
  docType,
  settings,
  onClose,
}: {
  docType: LegalDocType;
  settings: SiteSettings;
  onClose: () => void;
}) {
  if (!docType) return null;

  const titles: Record<Exclude<LegalDocType, null>, string> = {
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    cancellation: 'Booking & Cancellation Information',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-4 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{titles[docType]}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal dialog"
            className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">
          {docType === 'privacy' && (
            <>
              <p>
                <strong>{settings.businessName}</strong> respects your privacy. Information submitted through our booking enquiry, contact, or newsletter forms (such as your name, mobile number, email address, and travel preferences) is used solely to coordinate tour quotes and departures.
              </p>
              <p>
                Customer enquiries are accessible exclusively to authorized tour administrators via authenticated sessions. We do not sell or share personal contact records with unrelated third parties.
              </p>
            </>
          )}
          {docType === 'terms' && (
            <>
              <p>
                Submitting a booking enquiry through this website registers a priority request and does not constitute a confirmed seat or payment receipt.
              </p>
              <p>
                Final tour tariffs, hotel allocations, vehicle types, and batch departure dates are confirmed directly by {settings.businessName} after checking seat availability. Mountain itineraries (including Atal Tunnel, Solang Valley, Kashmir valleys, and Kedarkantha treks) remain subject to local weather, road conditions, and government advisories.
              </p>
            </>
          )}
          {docType === 'cancellation' && (
            <>
              <p>{settings.cancellationPolicy}</p>
              <p>
                For rescheduling or group cancellation queries, contact {settings.businessName} with your Enquiry ID before the departure cut-off date.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage({ onGoHome }: { onGoHome: () => void }) {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-20 text-center bg-slate-50">
      <div className="w-16 h-16 rounded-2xl bg-[#0B1F3A] text-amber-300 flex items-center justify-center mb-6">
        <Compass className="w-8 h-8" aria-hidden="true" />
      </div>
      <p className="font-mono text-sm font-semibold text-sky-700">404 · Route Not Found</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">
        This Mountain Trail Doesn&rsquo;t Exist
      </h1>
      <p className="mt-3 text-sm text-slate-600 max-w-md">
        The tour page or link you visited may have been updated or moved. Return to our homepage to explore active Himalayan packages.
      </p>
      <button
        type="button"
        onClick={onGoHome}
        className="mt-6 px-6 py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
      >
        Return to Homepage
      </button>
    </main>
  );
}
