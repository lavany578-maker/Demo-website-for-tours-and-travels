import { useCallback, useEffect, useState } from 'react';
import { fetchBootstrap } from './lib/api.ts';
import type { PackageType, PublicBootstrapData, TripPackage } from './types/travel.ts';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { CommunityAndInfoSection } from './components/CommunityAndInfoSection.tsx';
import { ContactSection } from './components/ContactSection.tsx';
import { EnquiryActionPage } from './components/EnquiryActionPage.tsx';
import { EnquirySection } from './components/EnquirySection.tsx';
import { FloatingWidgets } from './components/FloatingWidgets.tsx';
import { Header } from './components/Header.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { LegalModal, NotFoundPage, type LegalDocType } from './components/LegalAnd404.tsx';
import { TripDetailsModal } from './components/TripDetailsModal.tsx';
import { TripPackagesSection } from './components/TripPackagesSection.tsx';

const FALLBACK_SETTINGS = {
  businessName: 'AAI EKVEERA MAULI TOURS & TRAVEL',
  tagline: 'आपला विश्वास... आमची जबाबदारी...',
  mobile: '+91 00000 00000 (Placeholder — Update in Admin)',
  whatsapp: '',
  email: 'contact@placeholder-update-in-admin.in',
  adminNotificationEmail: '',
  officeAddress: 'Office Address Pending Owner Verification, Maharashtra, India',
  officeLat: 19.076,
  officeLng: 72.8777,
  instagramHandle: '@aai_ekveera_mauli_tours_0139',
  instagramUrl: 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
  completedTours: null,
  happyTravellers: null,
  statsVerified: false,
  contactVerified: false,
  cancellationPolicy: '',
};

function resolveInitialRoute(): {
  view: 'home' | 'admin' | 'enquiry-action' | 'not-found';
  tripSlug: string | null;
} {
  const path = window.location.pathname;
  if (path === '/' || path === '') return { view: 'home', tripSlug: null };
  if (path === '/admin') return { view: 'admin', tripSlug: null };
  if (path === '/enquiry-action') return { view: 'enquiry-action', tripSlug: null };
  if (path.startsWith('/trips/')) {
    const slug = path.slice('/trips/'.length).replace(/\/+$/, '');
    return { view: 'home', tripSlug: slug || null };
  }
  return { view: 'not-found', tripSlug: null };
}

export default function App() {
  const initialRoute = resolveInitialRoute();
  const [activeView, setActiveView] = useState<'home' | 'admin' | 'enquiry-action' | 'not-found'>(
    initialRoute.view
  );
  const [pendingSlug, setPendingSlug] = useState<string | null>(initialRoute.tripSlug);

  const [data, setData] = useState<PublicBootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<TripPackage | null>(null);
  const [enquiryTripId, setEnquiryTripId] = useState<number | null>(null);
  const [enquiryPrefill, setEnquiryPrefill] = useState<{
    adults: number;
    children: number;
    packageType: PackageType;
  } | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  // Admin auth token held strictly in React memory (never localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Tier 1/2 Google Maps Demo Key quota exceeded banner state
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const loadPublicData = useCallback(async () => {
    try {
      const res = await fetchBootstrap();
      setData(res);
    } catch (err) {
      console.error('Failed to load bootstrap data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  // Resolve SEO-friendly /trips/:slug route
  useEffect(() => {
    if (pendingSlug && data?.trips) {
      const found = data.trips.find((t) => t.slug === pendingSlug);
      if (found) {
        setSelectedTrip(found);
      } else {
        setActiveView('not-found');
      }
      setPendingSlug(null);
    }
  }, [pendingSlug, data]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      const next = resolveInitialRoute();
      setActiveView(next.view);
      if (next.tripSlug && data?.trips) {
        const found = data.trips.find((t) => t.slug === next.tripSlug);
        setSelectedTrip(found || null);
        if (!found) setActiveView('not-found');
      } else {
        setSelectedTrip(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [data]);

  const scrollToSection = (sectionId?: string) => {
    setActiveView('home');
    setSelectedTrip(null);
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenTripDetails = (trip: TripPackage) => {
    setSelectedTrip(trip);
    window.history.pushState({}, '', `/trips/${trip.slug}`);
  };

  const handleCloseTripDetails = () => {
    setSelectedTrip(null);
    if (window.location.pathname.startsWith('/trips/')) {
      window.history.pushState({}, '', '/');
    }
  };

  const handleBookNow = (
    trip?: TripPackage,
    prefill?: { adults: number; children: number; packageType: PackageType }
  ) => {
    setSelectedTrip(null);
    if (trip) setEnquiryTripId(trip.id);
    if (prefill) setEnquiryPrefill(prefill);
    scrollToSection('enquiry');
  };

  const handleOpenAdmin = () => {
    setSelectedTrip(null);
    setActiveView('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState({}, '', '/admin');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const settings = data?.settings || FALLBACK_SETTINGS;
  const trips = data?.trips || [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Required Google Maps Demo Key Quota Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        activeView={activeView}
        onNavigateHome={scrollToSection}
        onOpenAdmin={handleOpenAdmin}
        onOpenEnquiry={() => scrollToSection('enquiry')}
      />

      {activeView === 'admin' ? (
        <AdminDashboard
          token={adminToken}
          onTokenChange={setAdminToken}
          onPublicDataRefresh={loadPublicData}
          onExitAdmin={() => scrollToSection()}
        />
      ) : activeView === 'enquiry-action' ? (
        <EnquiryActionPage onGoHome={() => scrollToSection()} />
      ) : activeView === 'not-found' ? (
        <NotFoundPage onGoHome={() => scrollToSection()} />
      ) : (
        <main className="flex-1">
          <HeroSection
            trips={trips}
            settings={settings}
            onExploreTrips={() => scrollToSection('packages')}
            onBookTrip={() => scrollToSection('enquiry')}
            onContactUs={() => scrollToSection('contact')}
            onViewTripDetails={handleOpenTripDetails}
          />

          <TripPackagesSection
            trips={trips}
            loading={loading}
            onViewDetails={handleOpenTripDetails}
            onBookNow={(trip, prefill) => handleBookNow(trip, prefill)}
          />

          <EnquirySection
            trips={trips}
            settings={settings}
            preselectedTripId={enquiryTripId}
            prefillConfig={enquiryPrefill}
          />

          <CommunityAndInfoSection
            instagramPosts={data?.instagramPosts || []}
            testimonials={data?.testimonials || []}
            faqs={data?.faqs || []}
            settings={settings}
          />

          <ContactSection settings={settings} mapsApiKey={data?.mapsApiKey || ''} />
        </main>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="bg-[#07162B] text-slate-300 border-t border-white/10 pb-20 sm:pb-10 pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-white/10">
            <div className="md:col-span-5 space-y-2">
              <div className="font-display text-lg font-bold text-white">{settings.businessName}</div>
              <div className="text-sm text-amber-300 font-medium">{settings.tagline}</div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Curated group tours, family holidays, couple getaways, and Himalayan treks across India.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2 text-xs">
              <div className="font-semibold text-white">Explore</div>
              <ul className="space-y-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('packages')}
                    className="hover:text-white cursor-pointer"
                  >
                    Upcoming Packages
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('enquiry')}
                    className="hover:text-white cursor-pointer"
                  >
                    Booking Enquiry
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('contact')}
                    className="hover:text-white cursor-pointer"
                  >
                    Contact &amp; Map
                  </button>
                </li>
                <li>
                  <button type="button" onClick={handleOpenAdmin} className="hover:text-white cursor-pointer">
                    Owner Admin Login
                  </button>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-2 text-xs">
              <div className="font-semibold text-white">Policies &amp; Support</div>
              <ul className="space-y-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalDoc('privacy')}
                    className="hover:text-white cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalDoc('terms')}
                    className="hover:text-white cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLegalDoc('cancellation')}
                    className="hover:text-white cursor-pointer"
                  >
                    Booking Cancellation Information
                  </button>
                </li>
                <li>
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-300"
                  >
                    Instagram {settings.instagramHandle}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              &copy; {new Date().getFullYear()} {settings.businessName}. All rights reserved.
            </span>
            <span>All enquiries subject to seat availability &amp; operator confirmation.</span>
          </div>
        </div>
      </footer>

      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip}
          onClose={handleCloseTripDetails}
          onBookTrip={(trip) => handleBookNow(trip)}
        />
      )}

      <LegalModal docType={legalDoc} settings={settings} onClose={() => setLegalDoc(null)} />

      {activeView === 'home' && (
        <FloatingWidgets
          settings={settings}
          onBookClick={() => scrollToSection('enquiry')}
          onContactClick={() => scrollToSection('contact')}
          showMobileSticky={!selectedTrip && !legalDoc}
        />
      )}
    </div>
  );
}
