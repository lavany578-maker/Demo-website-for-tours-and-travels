import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  ImagePlus,
  Instagram,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  addFaqItem,
  addGalleryImage,
  addInstagramPost,
  addTestimonial,
  bootstrapAdminAccount,
  changeAdminPassword,
  createTrip,
  deleteFaqItem,
  deleteGalleryImage,
  deleteInstagramPost,
  deleteTestimonial,
  deleteTrip,
  fetchAdminDashboard,
  formatINR,
  getAuthStatus,
  loginAdmin,
  requestAdminPasswordReset,
  resetAdminPasswordWithToken,
  sendAdminTestEmail,
  updateEnquiryStatus,
  updateSiteSettings,
  updateTrip,
  uploadAdminImage,
} from '../lib/api.ts';
import type {
  CustomerEnquiry,
  DestinationImage,
  EmailNotificationLog,
  EnquiryStatus,
  FaqItem,
  InstagramPost,
  ItineraryDay,
  PackageStatus,
  SiteSettings,
  Testimonial,
  TripPackage,
} from '../types/travel.ts';
import { SafeImage } from './SafeImage.tsx';

interface AdminDashboardProps {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onPublicDataRefresh: () => void;
  onExitAdmin: () => void;
}

type AdminTab = 'trips' | 'enquiries' | 'notifications' | 'media' | 'community' | 'settings';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function emptyTripForm(): Partial<TripPackage> {
  return {
    title: '',
    destination: '',
    subtitle: '',
    summary: '',
    cover_image: '/src/assets/images/package_manali_solang_1795421892503.jpg',
    start_date: '',
    return_date: '',
    days: 5,
    nights: 4,
    price_per_person: null,
    couple_price: null,
    available_seats: null,
    departure_location: '',
    status: 'Upcoming',
    is_verified: false,
    price_note: '',
    hotel_info: '',
    food_info: '',
    transport_info: '',
    inclusions: [],
    exclusions: [],
    instructions: [],
    latitude: null,
    longitude: null,
    is_featured: true,
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival & Local Sightseeing',
        location: '',
        description: '',
        meals: '',
        stay: '',
        highlights: [],
      },
    ],
  };
}

export function AdminDashboard({
  token,
  onTokenChange,
  onPublicDataRefresh,
  onExitAdmin,
}: AdminDashboardProps) {
  const [authStatus, setAuthStatus] = useState<{
    needsSetup: boolean;
    envPasscodeConfigured: boolean;
    authenticated: boolean;
    user: { username: string; displayName: string; role: string } | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Setup / Login / Password Reset form state
  const [username, setUsername] = useState('owner');
  const [displayName, setDisplayName] = useState('Tour Administrator');
  const [setupEmail, setSetupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string>(
    () => new URLSearchParams(window.location.search).get('reset_token') || ''
  );
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  // Dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('trips');
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [trips, setTrips] = useState<TripPackage[]>([]);
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [gallery, setGallery] = useState<DestinationImage[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [settingsForm, setSettingsForm] = useState<SiteSettings | null>(null);
  const [contactMessages, setContactMessages] = useState<
    Array<{ id: number; name: string; mobile: string; email: string; subject: string; message: string; created_at: string }>
  >([]);
  const [newsletterCount, setNewsletterCount] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState<EmailNotificationLog[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [adminRecoveryEmail, setAdminRecoveryEmail] = useState('');

  // Authenticated password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [confirmNextPwd, setConfirmNextPwd] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Trip Editor state
  const [editingTripId, setEditingTripId] = useState<number | 'new' | null>(null);
  const [tripForm, setTripForm] = useState<Partial<TripPackage>>(emptyTripForm());
  const [savingTrip, setSavingTrip] = useState(false);

  // Enquiries Filter state
  const [enqSearch, setEnqSearch] = useState('');
  const [enqTripFilter, setEnqTripFilter] = useState('All');
  const [enqStatusFilter, setEnqStatusFilter] = useState<'All' | EnquiryStatus>('All');

  // Media forms
  const [galleryTripId, setGalleryTripId] = useState<string>('');
  const [galleryDest, setGalleryDest] = useState('');
  const [galleryUrl, setGalleryUrl] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');

  const [igImageUrl, setIgImageUrl] = useState('');
  const [igCaption, setIgCaption] = useState('');
  const [igPostUrl, setIgPostUrl] = useState('https://www.instagram.com/aai_ekveera_mauli_tours_0139/');
  const [igTag, setIgTag] = useState('');

  // Community forms
  const [testName, setTestName] = useState('');
  const [testCity, setTestCity] = useState('');
  const [testTrip, setTestTrip] = useState('');
  const [testQuote, setTestQuote] = useState('');
  const [testIsDemo, setTestIsDemo] = useState(false);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');

  const notify = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4000);
  };

  const checkAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const s = await getAuthStatus(token);
      setAuthStatus(s);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not verify authentication status.');
    } finally {
      setAuthLoading(false);
    }
  }, [token]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const data = await fetchAdminDashboard(token);
      setTrips(data.trips);
      setEnquiries(data.enquiries);
      setGallery(data.gallery);
      setTestimonials(data.testimonials);
      setInstagramPosts(data.instagramPosts);
      setFaqs(data.faqs);
      setSettingsForm(data.settings);
      setContactMessages(data.contactMessages);
      setNewsletterCount(data.newsletterCount);
      setEmailNotifications(data.emailNotifications || []);
      setSmtpConfigured(Boolean(data.smtpConfigured));
      setAdminRecoveryEmail(data.adminEmail || data.settings.adminNotificationEmail || '');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (token && authStatus?.authenticated) {
      loadDashboard();
    }
  }, [token, authStatus?.authenticated, loadDashboard]);

  const handleSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthSubmitting(true);
    try {
      const res = await bootstrapAdminAccount({
        username,
        displayName,
        email: setupEmail.trim() || undefined,
        password,
      });
      onTokenChange(res.token);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthSubmitting(true);
    try {
      const res = await loginAdmin({ username, password });
      onTokenChange(res.token);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthSubmitting(true);
    try {
      const res = await requestAdminPasswordReset(resetIdentifier);
      setAuthNotice(
        res.smtpConfigured
          ? res.message
          : `${res.message} Note: Outgoing SMTP secrets (SMTP_HOST, SMTP_USER, SMTP_PASS) must be configured on the server to deliver reset emails.`
      );
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Password reset request failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResetWithTokenSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (newResetPassword !== confirmResetPassword) {
      setAuthError('New password and confirmation do not match.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await resetAdminPasswordWithToken({
        token: resetToken,
        newPassword: newResetPassword,
      });
      setResetToken('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      window.history.replaceState({}, '', '/admin');
      setAuthNotice(res.message);
      setForgotMode(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleImageFileUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    onUrlReady: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await uploadAdminImage(token, dataUrl);
      onUrlReady(res.url);
      notify('ok', 'Image uploaded to server.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveTrip = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingTrip(true);
    try {
      if (editingTripId === 'new') {
        const res = await createTrip(token, tripForm);
        setTrips(res.trips);
        notify('ok', 'New tour package created and published.');
      } else if (typeof editingTripId === 'number') {
        const res = await updateTrip(token, editingTripId, tripForm);
        setTrips(res.trips);
        notify('ok', 'Tour package updated.');
      }
      setEditingTripId(null);
      onPublicDataRefresh();
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save package.');
    } finally {
      setSavingTrip(false);
    }
  };

  const handleQuickTripStatus = async (trip: TripPackage, nextStatus: PackageStatus) => {
    if (!token) return;
    try {
      const res = await updateTrip(token, trip.id, { ...trip, status: nextStatus });
      setTrips(res.trips);
      onPublicDataRefresh();
      notify('ok', `${trip.title} marked as ${nextStatus}.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  const handleDeleteTrip = async (trip: TripPackage) => {
    if (!token) return;
    try {
      const res = await deleteTrip(token, trip.id);
      setTrips(res.trips);
      onPublicDataRefresh();
      notify('ok', 'Tour package deleted.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleUpdateEnquiry = async (
    id: number,
    status: EnquiryStatus,
    notes: string,
    notifyCustomer = false
  ) => {
    if (!token) return;
    try {
      const res = await updateEnquiryStatus(token, id, status, notes, notifyCustomer);
      setEnquiries(res.enquiries);
      if (res.emailNotifications) setEmailNotifications(res.emailNotifications);
      notify(
        'ok',
        notifyCustomer
          ? res.customerEmailStatus === 'sent'
            ? 'Enquiry confirmed & email sent to customer.'
            : 'Enquiry confirmed & customer email logged.'
          : 'Enquiry status updated.'
      );
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to update enquiry.');
    }
  };

  const handleExportCsv = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/enquiries/export.csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aai-ekveera-mauli-enquiries.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('ok', 'Enquiries CSV exported.');
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to export CSV.');
    }
  };

  const filteredEnquiries = useMemo(() => {
    const q = enqSearch.trim().toLowerCase();
    return enquiries.filter((e) => {
      const matchSearch =
        !q ||
        e.full_name.toLowerCase().includes(q) ||
        e.mobile.toLowerCase().includes(q) ||
        e.enquiry_code.toLowerCase().includes(q);
      const matchTrip = enqTripFilter === 'All' || e.trip_title === enqTripFilter;
      const matchStatus = enqStatusFilter === 'All' || e.status === enqStatusFilter;
      return matchSearch && matchTrip && matchStatus;
    });
  }, [enquiries, enqSearch, enqTripFilter, enqStatusFilter]);

  const kpis = useMemo(() => {
    const openTrips = trips.filter((t) => t.status === 'Booking Open' || t.status === 'Filling Fast').length;
    const newEnq = enquiries.filter((e) => e.status === 'New').length;
    const destCount = new Set(trips.map((t) => t.destination)).size;
    return {
      totalEnquiries: enquiries.length,
      newEnquiries: newEnq,
      openTrips,
      destCount,
    };
  }, [trips, enquiries]);

  // Auth Gate View
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">Checking administrator session...</p>
      </div>
    );
  }

  if (!token || !authStatus?.authenticated) {
    const needsSetup = Boolean(authStatus?.needsSetup);
    return (
      <main className="min-h-[80vh] bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-7 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-[#0B1F3A] text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[#0B1F3A]">
                {needsSetup ? 'Initial Admin Setup' : 'Administrator Login'}
              </h1>
              <p className="text-xs text-slate-500">Aai Ekveera Mauli Tours &amp; Travel</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800" role="alert">
              {authError}
            </div>
          )}

          {authNotice && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900" role="status">
              {authNotice}
            </div>
          )}

          {resetToken ? (
            <form onSubmit={handleResetWithTokenSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed bg-sky-50 border border-sky-200 rounded-lg p-3">
                Set a new password for your administrator account below.
              </p>
              <div>
                <label htmlFor="reset-new-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  id="reset-new-pass"
                  type="password"
                  required
                  minLength={8}
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-pass"
                  type="password"
                  required
                  minLength={8}
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
              >
                {authSubmitting ? 'Updating Password...' : 'Save New Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetToken('');
                  window.history.replaceState({}, '', '/admin');
                }}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          ) : needsSetup ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed bg-sky-50 border border-sky-200 rounded-lg p-3">
                First-run setup: Create your owner administrator credentials below. Once created, this setup screen locks automatically.
              </p>
              <div>
                <label htmlFor="setup-user" className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Username
                </label>
                <input
                  id="setup-user"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="setup-display" className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  id="setup-display"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="setup-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Recovery &amp; Notification Email
                </label>
                <input
                  id="setup-email"
                  type="email"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="owner@yourdomain.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="setup-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                  Choose Password (min. 8 characters)
                </label>
                <input
                  id="setup-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
              >
                {authSubmitting ? 'Creating Account...' : 'Create Owner Account & Enter'}
              </button>
            </form>
          ) : forgotMode ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed bg-sky-50 border border-sky-200 rounded-lg p-3">
                Enter your admin username or configured recovery email to receive a password reset link.
              </p>
              <div>
                <label htmlFor="forgot-identifier" className="block text-xs font-semibold text-slate-700 mb-1">
                  Username or Recovery Email
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  required
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="owner or you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
              >
                {authSubmitting ? 'Sending Reset Link...' : 'Send Password Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setAuthError(null);
                  setAuthNotice(null);
                }}
                className="w-full py-2 text-xs font-medium text-slate-600 hover:text-[#0B1F3A] cursor-pointer"
              >
                Back to Password Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-user" className="block text-xs font-semibold text-slate-700 mb-1">
                  Username or Email
                </label>
                <input
                  id="login-user"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="login-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="login-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
              >
                {authSubmitting ? 'Signing In...' : 'Sign In to Dashboard'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setAuthError(null);
                  setAuthNotice(null);
                  setResetIdentifier(username);
                }}
                className="w-full py-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
              >
                Forgot / Reset Admin Password?
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onExitAdmin}
            className="mt-4 w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Back to Public Website
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0B1F3A] text-white shrink-0 p-5 flex flex-col justify-between">
        <div>
          <div className="pb-5 border-b border-white/10">
            <div className="font-display text-base font-bold text-white">Tour Control Center</div>
            <div className="text-xs text-sky-200/80 mt-0.5 truncate">
              Signed in as {authStatus.user?.displayName || 'Admin'}
            </div>
          </div>

          <nav className="mt-5 space-y-1.5" aria-label="Admin sections">
            {[
              { id: 'trips' as const, label: 'Trips & Itineraries', icon: Package },
              { id: 'enquiries' as const, label: 'Customer Enquiries', icon: MessageSquare },
              { id: 'notifications' as const, label: 'Email & Alerts', icon: Mail },
              { id: 'media' as const, label: 'Gallery & Instagram', icon: Instagram },
              { id: 'community' as const, label: 'Reviews & FAQs', icon: LayoutDashboard },
              { id: 'settings' as const, label: 'Contact & Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active ? 'bg-amber-400 text-[#0B1F3A] font-semibold' : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            View Public Website
          </button>
          <button
            type="button"
            onClick={() => onTokenChange(null)}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-200 hover:bg-rose-500/20 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        {toast && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium border flex items-center gap-2 ${
              toast.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{toast.text}</span>
          </div>
        )}

        {/* KPI Overview Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Total Enquiries</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] tabular-nums">
              {kpis.totalEnquiries}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs text-slate-500">New Enquiries</div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
              {kpis.newEnquiries}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Open Booking Trips</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {kpis.openTrips}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Destinations &amp; Subscribers</div>
            <div className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] tabular-nums">
              {kpis.destCount} / {newsletterCount}
            </div>
          </div>
        </div>

        {loadingData && <p className="text-xs text-slate-500">Syncing latest database records...</p>}

        {!loadingData &&
          settingsForm &&
          !settingsForm.adminNotificationEmail &&
          !adminRecoveryEmail &&
          activeTab !== 'settings' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <span>
                <strong>Admin Notification Email not configured:</strong> Set your email address to automatically receive alerts and one-click confirmation links whenever a customer submits a new enquiry.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-1.5 font-semibold bg-[#0B1F3A] text-white rounded-lg shrink-0 cursor-pointer hover:bg-[#13315C]"
              >
                Set Notification Email
              </button>
            </div>
          )}

        {/* TAB 1: TRIPS & ITINERARIES */}
        {activeTab === 'trips' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                  Tour Packages &amp; Itineraries
                </h1>
                <p className="text-xs text-slate-600">
                  Changes made here update the public website immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingTripId('new');
                  setTripForm(emptyTripForm());
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add New Package
              </button>
            </div>

            {editingTripId !== null ? (
              <form
                onSubmit={handleSaveTrip}
                className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    {editingTripId === 'new' ? 'Create New Tour Package' : `Edit: ${tripForm.title}`}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingTripId(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tour Title *</label>
                    <input
                      type="text"
                      required
                      value={tripForm.title || ''}
                      onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination *</label>
                    <input
                      type="text"
                      required
                      value={tripForm.destination || ''}
                      onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={tripForm.status || 'Upcoming'}
                      onChange={(e) => setTripForm({ ...tripForm, status: e.target.value as PackageStatus })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Booking Open">Booking Open</option>
                      <option value="Filling Fast">Filling Fast</option>
                      <option value="Fully Booked">Fully Booked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Location</label>
                    <input
                      type="text"
                      value={tripForm.departure_location || ''}
                      onChange={(e) => setTripForm({ ...tripForm, departure_location: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={tripForm.start_date || ''}
                      onChange={(e) => setTripForm({ ...tripForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Return Date</label>
                    <input
                      type="date"
                      value={tripForm.return_date || ''}
                      onChange={(e) => setTripForm({ ...tripForm, return_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Days</label>
                      <input
                        type="number"
                        min={1}
                        value={tripForm.days ?? 1}
                        onChange={(e) => setTripForm({ ...tripForm, days: Number(e.target.value) || 1 })}
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nights</label>
                      <input
                        type="number"
                        min={0}
                        value={tripForm.nights ?? 0}
                        onChange={(e) => setTripForm({ ...tripForm, nights: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Price/Person ₹</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Optional"
                        value={tripForm.price_per_person ?? ''}
                        onChange={(e) =>
                          setTripForm({
                            ...tripForm,
                            price_per_person: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Couple ₹</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Optional"
                        value={tripForm.couple_price ?? ''}
                        onChange={(e) =>
                          setTripForm({
                            ...tripForm,
                            couple_price: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Seats</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Optional"
                        value={tripForm.available_seats ?? ''}
                        onChange={(e) =>
                          setTripForm({
                            ...tripForm,
                            available_seats: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Cover Image Upload & URL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cover Image URL</label>
                    <input
                      type="text"
                      value={tripForm.cover_image || ''}
                      onChange={(e) => setTripForm({ ...tripForm, cover_image: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200 rounded-lg cursor-pointer hover:bg-sky-100">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Upload Cover Image (PNG/JPG/WebP)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          handleImageFileUpload(e, (url) => setTripForm((prev) => ({ ...prev, cover_image: url })))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tour Summary</label>
                  <textarea
                    rows={3}
                    value={tripForm.summary || ''}
                    onChange={(e) => setTripForm({ ...tripForm, summary: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hotel Info</label>
                    <textarea
                      rows={2}
                      value={tripForm.hotel_info || ''}
                      onChange={(e) => setTripForm({ ...tripForm, hotel_info: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Food Info</label>
                    <textarea
                      rows={2}
                      value={tripForm.food_info || ''}
                      onChange={(e) => setTripForm({ ...tripForm, food_info: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Transport Info</label>
                    <textarea
                      rows={2}
                      value={tripForm.transport_info || ''}
                      onChange={(e) => setTripForm({ ...tripForm, transport_info: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Inclusions (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={(tripForm.inclusions || []).join('\n')}
                      onChange={(e) =>
                        setTripForm({ ...tripForm, inclusions: e.target.value.split('\n').filter(Boolean) })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Exclusions (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={(tripForm.exclusions || []).join('\n')}
                      onChange={(e) =>
                        setTripForm({ ...tripForm, exclusions: e.target.value.split('\n').filter(Boolean) })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Travel Instructions (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={(tripForm.instructions || []).join('\n')}
                      onChange={(e) =>
                        setTripForm({ ...tripForm, instructions: e.target.value.split('\n').filter(Boolean) })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tripForm.is_verified)}
                      onChange={(e) => setTripForm({ ...tripForm, is_verified: e.target.checked })}
                    />
                    Mark dates, pricing &amp; seats as Owner Verified
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(tripForm.is_featured)}
                      onChange={(e) => setTripForm({ ...tripForm, is_featured: e.target.checked })}
                    />
                    Feature in Homepage Destination Carousel
                  </label>
                </div>

                {/* Day-wise Itinerary Editor */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Day-Wise Itinerary</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const current = (tripForm.itinerary || []) as ItineraryDay[];
                        setTripForm({
                          ...tripForm,
                          itinerary: [
                            ...current,
                            {
                              day_number: current.length + 1,
                              title: `Day ${current.length + 1}`,
                              location: '',
                              description: '',
                              meals: '',
                              stay: '',
                              highlights: [],
                            },
                          ],
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg cursor-pointer"
                    >
                      + Add Day
                    </button>
                  </div>

                  {((tripForm.itinerary || []) as ItineraryDay[]).map((day, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0B1F3A]">Day {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = ((tripForm.itinerary || []) as ItineraryDay[])
                              .filter((_, i) => i !== idx)
                              .map((d, i) => ({ ...d, day_number: i + 1 }));
                            setTripForm({ ...tripForm, itinerary: next });
                          }}
                          className="text-xs text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Day Title"
                          value={day.title}
                          onChange={(e) => {
                            const next = [...((tripForm.itinerary || []) as ItineraryDay[])];
                            next[idx] = { ...day, title: e.target.value };
                            setTripForm({ ...tripForm, itinerary: next });
                          }}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Location"
                          value={day.location}
                          onChange={(e) => {
                            const next = [...((tripForm.itinerary || []) as ItineraryDay[])];
                            next[idx] = { ...day, location: e.target.value };
                            setTripForm({ ...tripForm, itinerary: next });
                          }}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Meals (e.g. Breakfast & Dinner)"
                          value={day.meals}
                          onChange={(e) => {
                            const next = [...((tripForm.itinerary || []) as ItineraryDay[])];
                            next[idx] = { ...day, meals: e.target.value };
                            setTripForm({ ...tripForm, itinerary: next });
                          }}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Stay (e.g. Manali Hotel)"
                          value={day.stay}
                          onChange={(e) => {
                            const next = [...((tripForm.itinerary || []) as ItineraryDay[])];
                            next[idx] = { ...day, stay: e.target.value };
                            setTripForm({ ...tripForm, itinerary: next });
                          }}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Day itinerary description"
                        value={day.description}
                        onChange={(e) => {
                          const next = [...((tripForm.itinerary || []) as ItineraryDay[])];
                          next[idx] = { ...day, description: e.target.value };
                          setTripForm({ ...tripForm, itinerary: next });
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingTripId(null)}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTrip}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl cursor-pointer"
                  >
                    {savingTrip ? 'Saving...' : 'Save Tour Package'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                        <SafeImage src={trip.cover_image} alt={trip.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-[#0B1F3A] truncate">{trip.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          {trip.days}D/{trip.nights}N · {formatINR(trip.price_per_person)} · Seats:{' '}
                          {trip.available_seats ?? 'Unset'} · {trip.is_verified ? 'Verified' : 'Sample'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        aria-label={`Status for ${trip.title}`}
                        value={trip.status}
                        onChange={(e) => handleQuickTripStatus(trip, e.target.value as PackageStatus)}
                        className="px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Booking Open">Booking Open</option>
                        <option value="Filling Fast">Filling Fast</option>
                        <option value="Fully Booked">Fully Booked</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTripId(trip.id);
                          setTripForm(trip);
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTrip(trip)}
                        aria-label={`Delete ${trip.title}`}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: CUSTOMER ENQUIRIES */}
        {activeTab === 'enquiries' && (
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Customer Enquiries</h1>
                <p className="text-xs text-slate-600">
                  Search by customer name or mobile, filter by trip, update status, and export CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Export CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={enqSearch}
                  onChange={(e) => setEnqSearch(e.target.value)}
                  placeholder="Search name, mobile, or AEM code..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <select
                value={enqTripFilter}
                onChange={(e) => setEnqTripFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              >
                <option value="All">All Trips</option>
                {Array.from(new Set(enquiries.map((e) => e.trip_title))).map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
              <select
                value={enqStatusFilter}
                onChange={(e) => setEnqStatusFilter(e.target.value as 'All' | EnquiryStatus)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
              >
                <option value="All">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {filteredEnquiries.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                No enquiries match your current filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEnquiries.map((enq) => (
                  <div key={enq.id} className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-mono font-bold text-sky-700">{enq.enquiry_code}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="font-display text-sm font-bold text-[#0B1F3A]">{enq.full_name}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="font-mono text-slate-700 tabular-nums">{enq.mobile}</span>
                        {enq.email && (
                          <>
                            <span className="mx-2 text-slate-300">·</span>
                            <span className="text-slate-600">{enq.email}</span>
                          </>
                        )}
                        <span className="mx-2 text-slate-300">·</span>
                        <span
                          className={
                            enq.customer_confirmed ? 'font-semibold text-emerald-700' : 'text-slate-500'
                          }
                        >
                          {enq.customer_confirmed ? 'Confirmed by Customer' : 'Awaiting Customer'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {enq.status !== 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateEnquiry(enq.id, 'Confirmed', enq.admin_notes, true)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            {enq.email ? 'Confirm & Email Customer' : 'Confirm Request'}
                          </button>
                        )}
                        <select
                          aria-label={`Status for ${enq.enquiry_code}`}
                          value={enq.status}
                          onChange={(e) =>
                            handleUpdateEnquiry(enq.id, e.target.value as EnquiryStatus, enq.admin_notes, false)
                          }
                          className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block">Trip</span>
                        <span className="font-medium text-slate-800">{enq.trip_title}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Travellers</span>
                        <span className="font-mono tabular-nums">
                          {enq.total_travellers} ({enq.adults}A / {enq.children}C) · {enq.package_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Pickup &amp; Date</span>
                        <span>
                          {enq.pickup_location} ({enq.departure_date || 'Flexible'})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Submitted</span>
                        <span className="font-mono tabular-nums">{enq.created_at}</span>
                      </div>
                    </div>

                    {enq.requirements && (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">
                        <strong>Requirements:</strong> {enq.requirements}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Contact Form Inbox */}
            {contactMessages.length > 0 && (
              <div className="pt-6 border-t border-slate-200 space-y-3">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Direct Contact Messages</h2>
                {contactMessages.map((msg) => (
                  <div key={msg.id} className="rounded-xl bg-white border border-slate-200 p-4 text-xs space-y-1">
                    <div className="font-semibold text-[#0B1F3A]">
                      {msg.name} · <span className="font-mono">{msg.mobile}</span> · {msg.subject || 'General'}
                    </div>
                    <p className="text-slate-600">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2B: EMAIL NOTIFICATIONS & CONFIRMATIONS LOG */}
        {activeTab === 'notifications' && (
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                  Email Notifications &amp; Confirmations
                </h1>
                <p className="text-xs text-slate-600">
                  Real-time log of notifications dispatched to admin and customers with direct confirmation links.
                </p>
              </div>
              <button
                type="button"
                disabled={sendingTestEmail}
                onClick={async () => {
                  if (!token) return;
                  setSendingTestEmail(true);
                  try {
                    const res = await sendAdminTestEmail(
                      token,
                      settingsForm?.adminNotificationEmail || adminRecoveryEmail || undefined
                    );
                    setEmailNotifications(res.emailNotifications);
                    setSmtpConfigured(res.smtpConfigured);
                    notify(
                      res.deliveryStatus === 'sent' ? 'ok' : 'err',
                      res.deliveryStatus === 'sent'
                        ? `Test email delivered to ${res.recipient}.`
                        : `Test email logged for ${res.recipient}: ${res.errorMessage}`
                    );
                  } catch (err) {
                    notify('err', err instanceof Error ? err.message : 'Test email failed.');
                  } finally {
                    setSendingTestEmail(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {sendingTestEmail ? 'Sending Test...' : 'Send Test Email'}
              </button>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-semibold text-[#0B1F3A]">
                  Configured Admin Alert Email:{' '}
                  <span className="font-mono text-sky-700">
                    {settingsForm?.adminNotificationEmail || adminRecoveryEmail || 'Not configured yet (set in Settings)'}
                  </span>
                </div>
                <p className="text-slate-600 mt-1">
                  {smtpConfigured
                    ? 'SMTP mail transport is configured and delivering live notifications.'
                    : 'SMTP environment secrets (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM) are not yet configured. Notifications and direct confirmation links are still logged below.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0 cursor-pointer"
              >
                Configure Email in Settings
              </button>
            </div>

            {emailNotifications.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                No email notifications logged yet. Submit an enquiry or send a test email above.
              </div>
            ) : (
              <div className="space-y-3">
                {emailNotifications.map((log) => (
                  <div key={log.id} className="rounded-xl bg-white border border-slate-200 p-4 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-[#0B1F3A]">{log.subject}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="font-mono text-slate-600">To: {log.recipient_email}</span>
                      </div>
                      <div className="font-mono tabular-nums">
                        <span
                          className={
                            log.delivery_status === 'sent'
                              ? 'text-emerald-700 font-semibold'
                              : log.delivery_status === 'failed'
                                ? 'text-rose-700 font-semibold'
                                : 'text-amber-700 font-semibold'
                          }
                        >
                          {log.delivery_status}
                        </span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="text-slate-500">{log.created_at}</span>
                      </div>
                    </div>
                    <p className="text-slate-600 whitespace-pre-line">{log.body_text}</p>
                    {log.error_message && (
                      <p className="text-amber-800 bg-amber-50 rounded-lg px-3 py-1.5">{log.error_message}</p>
                    )}
                    {log.action_url && (
                      <div>
                        <a
                          href={log.action_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sky-700 font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          Open Confirmation Action Link
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: GALLERY & INSTAGRAM */}
        {activeTab === 'media' && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Destination Gallery Uploader */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Destination Photo Gallery</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  try {
                    const res = await addGalleryImage(token, {
                      trip_id: galleryTripId ? Number(galleryTripId) : null,
                      destination_name: galleryDest,
                      image_url: galleryUrl,
                      caption: galleryCaption,
                    });
                    setGallery(res.gallery);
                    setGalleryDest('');
                    setGalleryUrl('');
                    setGalleryCaption('');
                    onPublicDataRefresh();
                    notify('ok', 'Destination photo added.');
                  } catch (err) {
                    notify('err', err instanceof Error ? err.message : 'Failed to add photo.');
                  }
                }}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <select
                  value={galleryTripId}
                  onChange={(e) => setGalleryTripId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="">General Destination Gallery</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      Attach to: {t.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Destination Name (e.g. Manali)"
                  value={galleryDest}
                  onChange={(e) => setGalleryDest(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Image URL or upload ->"
                    value={galleryUrl}
                    onChange={(e) => setGalleryUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200 rounded-lg cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileUpload(e, setGalleryUrl)}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Caption"
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                >
                  Add Destination Photo
                </button>
              </form>

              <div className="grid grid-cols-2 gap-3">
                {gallery.map((img) => (
                  <div key={img.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                    <div className="aspect-[4/3] bg-slate-900">
                      <SafeImage src={img.image_url} alt={img.caption || img.destination_name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{img.destination_name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const res = await deleteGalleryImage(token, img.id);
                          setGallery(res.gallery);
                          onPublicDataRefresh();
                        }}
                        className="text-rose-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Instagram Poster & Post Uploader */}
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                Instagram Photos &amp; Posters
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  try {
                    const res = await addInstagramPost(token, {
                      image_url: igImageUrl,
                      caption: igCaption,
                      post_url: igPostUrl,
                      tag: igTag,
                    });
                    setInstagramPosts(res.instagramPosts);
                    setIgImageUrl('');
                    setIgCaption('');
                    setIgTag('');
                    onPublicDataRefresh();
                    notify('ok', 'Instagram poster published.');
                  } catch (err) {
                    notify('err', err instanceof Error ? err.message : 'Failed to add Instagram post.');
                  }
                }}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Poster Image URL or upload ->"
                    value={igImageUrl}
                    onChange={(e) => setIgImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-50 text-sky-900 border border-sky-200 rounded-lg cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileUpload(e, setIgImageUrl)}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Tag (e.g. Manali Special)"
                  value={igTag}
                  onChange={(e) => setIgTag(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="url"
                  placeholder="Instagram Post Link"
                  value={igPostUrl}
                  onChange={(e) => setIgPostUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <textarea
                  rows={2}
                  required
                  placeholder="Poster caption"
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
                >
                  Publish to Instagram Gallery
                </button>
              </form>

              <div className="grid grid-cols-2 gap-3">
                {instagramPosts.map((post) => (
                  <div key={post.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                    <div className="aspect-[3/4] bg-slate-900">
                      <SafeImage src={post.image_url} alt={post.caption} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{post.tag || 'Instagram'}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const res = await deleteInstagramPost(token, post.id);
                          setInstagramPosts(res.instagramPosts);
                          onPublicDataRefresh();
                        }}
                        className="text-rose-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: TESTIMONIALS & FAQS */}
        {activeTab === 'community' && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">Testimonials</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  const res = await addTestimonial(token, {
                    customer_name: testName,
                    city: testCity,
                    trip_name: testTrip,
                    quote: testQuote,
                    rating: 5,
                    is_demo: testIsDemo,
                  });
                  setTestimonials(res.testimonials);
                  setTestName('');
                  setTestCity('');
                  setTestTrip('');
                  setTestQuote('');
                  onPublicDataRefresh();
                  notify('ok', 'Testimonial saved.');
                }}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <input
                  type="text"
                  required
                  placeholder="Customer Name"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={testCity}
                    onChange={(e) => setTestCity(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Tour Name"
                    value={testTrip}
                    onChange={(e) => setTestTrip(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Customer review text..."
                  value={testQuote}
                  onChange={(e) => setTestQuote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={testIsDemo} onChange={(e) => setTestIsDemo(e.target.checked)} />
                  Mark as demonstration placeholder
                </label>
                <button type="submit" className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg cursor-pointer">
                  Add Testimonial
                </button>
              </form>

              <div className="space-y-2.5">
                {testimonials.map((t) => (
                  <div key={t.id} className="rounded-xl bg-white border border-slate-200 p-3.5 text-xs flex justify-between gap-3">
                    <div>
                      <div className="font-bold text-[#0B1F3A]">
                        {t.customer_name} {t.is_demo && <span className="text-amber-700 font-normal">(Demo)</span>}
                      </div>
                      <p className="text-slate-600 mt-1">{t.quote}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        const res = await deleteTestimonial(token, t.id);
                        setTestimonials(res.testimonials);
                        onPublicDataRefresh();
                      }}
                      className="text-rose-600 hover:underline shrink-0 self-start cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">FAQs</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  const res = await addFaqItem(token, { question: faqQ, answer: faqA });
                  setFaqs(res.faqs);
                  setFaqQ('');
                  setFaqA('');
                  onPublicDataRefresh();
                  notify('ok', 'FAQ added.');
                }}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <input
                  type="text"
                  required
                  placeholder="Question"
                  value={faqQ}
                  onChange={(e) => setFaqQ(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <textarea
                  rows={2}
                  required
                  placeholder="Answer"
                  value={faqA}
                  onChange={(e) => setFaqA(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button type="submit" className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg cursor-pointer">
                  Add FAQ Item
                </button>
              </form>

              <div className="space-y-2.5">
                {faqs.map((f) => (
                  <div key={f.id} className="rounded-xl bg-white border border-slate-200 p-3.5 text-xs flex justify-between gap-3">
                    <div>
                      <div className="font-bold text-[#0B1F3A]">{f.question}</div>
                      <p className="text-slate-600 mt-1">{f.answer}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        const res = await deleteFaqItem(token, f.id);
                        setFaqs(res.faqs);
                        onPublicDataRefresh();
                      }}
                      className="text-rose-600 hover:underline shrink-0 self-start cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: BUSINESS CONTACT, NOTIFICATIONS & ADMIN SECURITY SETTINGS */}
        {activeTab === 'settings' && settingsForm && (
          <section className="max-w-3xl space-y-8">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A] mb-4">
                Business Contact, Notifications &amp; Verified Statistics
              </h1>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token || !settingsForm) return;
                  try {
                    const res = await updateSiteSettings(token, settingsForm);
                    setSettingsForm(res.settings);
                    onPublicDataRefresh();
                    notify('ok', 'Business settings updated across the public website.');
                  } catch (err) {
                    notify('err', err instanceof Error ? err.message : 'Failed to save settings.');
                  }
                }}
                className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4"
              >
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-2">
                  <label htmlFor="admin-notif-email" className="block text-xs font-bold text-[#0B1F3A]">
                    Admin Notification Email (For New Enquiries &amp; Email Confirmations)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="admin-notif-email"
                      type="email"
                      value={settingsForm.adminNotificationEmail}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, adminNotificationEmail: e.target.value })
                      }
                      placeholder="owner-alerts@yourdomain.com"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={sendingTestEmail}
                      onClick={async () => {
                        if (!token) return;
                        setSendingTestEmail(true);
                        try {
                          const res = await sendAdminTestEmail(
                            token,
                            settingsForm.adminNotificationEmail || undefined
                          );
                          setEmailNotifications(res.emailNotifications);
                          setSmtpConfigured(res.smtpConfigured);
                          notify(
                            res.deliveryStatus === 'sent' ? 'ok' : 'err',
                            res.deliveryStatus === 'sent'
                              ? `Test email delivered to ${res.recipient}.`
                              : `Test notification logged (${res.errorMessage})`
                          );
                        } catch (err) {
                          notify('err', err instanceof Error ? err.message : 'Test email failed.');
                        } finally {
                          setSendingTestEmail(false);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold text-[#0B1F3A] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                    >
                      {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
                    </button>
                  </div>
                  <p className="text-[11px] text-sky-900">
                    When an enquiry is submitted or confirmed by a customer, you will receive an email with a direct confirmation link to approve their request.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={settingsForm.businessName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                    <input
                      type="text"
                      value={settingsForm.tagline}
                      onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                    <input
                      type="text"
                      value={settingsForm.mobile}
                      onChange={(e) => setSettingsForm({ ...settingsForm, mobile: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp Number (with country code, e.g. 9198XXXXXXXX)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsapp}
                      onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Public Display Email</label>
                    <input
                      type="email"
                      value={settingsForm.email}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram URL</label>
                    <input
                      type="url"
                      value={settingsForm.instagramUrl}
                      onChange={(e) => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Office Address</label>
                  <input
                    type="text"
                    value={settingsForm.officeAddress}
                    onChange={(e) => setSettingsForm({ ...settingsForm, officeAddress: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Office Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={settingsForm.officeLat}
                      onChange={(e) => setSettingsForm({ ...settingsForm, officeLat: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Office Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={settingsForm.officeLng}
                      onChange={(e) => setSettingsForm({ ...settingsForm, officeLng: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verified Completed Tours
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Leave blank until verified"
                      value={settingsForm.completedTours ?? ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          completedTours: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verified Happy Travellers
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Leave blank until verified"
                      value={settingsForm.happyTravellers ?? ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          happyTravellers: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.contactVerified}
                      onChange={(e) => setSettingsForm({ ...settingsForm, contactVerified: e.target.checked })}
                    />
                    Contact Details Verified by Owner
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.statsVerified}
                      onChange={(e) => setSettingsForm({ ...settingsForm, statsVerified: e.target.checked })}
                    />
                    Publish Verified Statistics on Homepage
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Booking Cancellation Policy
                  </label>
                  <textarea
                    rows={3}
                    value={settingsForm.cancellationPolicy}
                    onChange={(e) => setSettingsForm({ ...settingsForm, cancellationPolicy: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl cursor-pointer"
                >
                  Save Settings
                </button>
              </form>
            </div>

            {/* Admin Account Password Reset & Recovery Email */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#0B1F3A]" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Administrator Password Reset &amp; Recovery Email
                  </h2>
                  <p className="text-xs text-slate-500">
                    Update your admin password or set the email used for password reset links.
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!token) return;
                  if (nextPwd && nextPwd !== confirmNextPwd) {
                    notify('err', 'New password and confirmation do not match.');
                    return;
                  }
                  setSavingSecurity(true);
                  try {
                    const res = await changeAdminPassword(token, {
                      currentPassword: currentPwd,
                      newPassword: nextPwd || undefined,
                      recoveryEmail: adminRecoveryEmail.trim() || undefined,
                    });
                    setCurrentPwd('');
                    setNextPwd('');
                    setConfirmNextPwd('');
                    setAdminRecoveryEmail(res.adminEmail);
                    notify('ok', res.message);
                  } catch (err) {
                    notify('err', err instanceof Error ? err.message : 'Failed to update admin security.');
                  } finally {
                    setSavingSecurity(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sec-recovery-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Admin Recovery Email
                    </label>
                    <input
                      id="sec-recovery-email"
                      type="email"
                      value={adminRecoveryEmail}
                      onChange={(e) => setAdminRecoveryEmail(e.target.value)}
                      placeholder="owner@yourdomain.com"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="sec-cur-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                      Current Password *
                    </label>
                    <input
                      id="sec-cur-pwd"
                      type="password"
                      required
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="sec-new-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                      New Password (min. 8 chars, optional)
                    </label>
                    <input
                      id="sec-new-pwd"
                      type="password"
                      minLength={8}
                      value={nextPwd}
                      onChange={(e) => setNextPwd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="sec-confirm-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="sec-confirm-pwd"
                      type="password"
                      minLength={8}
                      value={confirmNextPwd}
                      onChange={(e) => setConfirmNextPwd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSecurity}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl cursor-pointer"
                >
                  {savingSecurity ? 'Updating...' : 'Update Password / Recovery Email'}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
