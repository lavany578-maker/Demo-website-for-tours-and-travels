import type {
  CustomerEnquiry,
  DestinationImage,
  EmailNotificationLog,
  EnquiryStatus,
  FaqItem,
  InstagramPost,
  PublicBootstrapData,
  SiteSettings,
  Testimonial,
  TripPackage,
  WeatherResponse,
} from '../types/travel.ts';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchBootstrap(): Promise<PublicBootstrapData> {
  return requestJson<PublicBootstrapData>('/api/bootstrap');
}

export function fetchWeather(lat: number, lng: number): Promise<WeatherResponse> {
  return requestJson<WeatherResponse>(`/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
}

export function submitEnquiry(payload: {
  fullName: string;
  mobile: string;
  email: string;
  tripId: number;
  departureDate: string;
  adults: number;
  children: number;
  totalTravellers: number;
  packageType: string;
  pickupLocation: string;
  requirements: string;
}) {
  return requestJson<{
    enquiry: {
      id: number;
      enquiry_code: string;
      trip_title: string;
      full_name: string;
      mobile: string;
      email?: string;
      departure_date: string;
      adults: number;
      children: number;
      total_travellers: number;
      package_type: string;
      pickup_location: string;
      status: string;
    };
    emailSummary?: {
      adminEmailConfigured: boolean;
      adminEmailStatus: string;
      customerEmailProvided: boolean;
      customerEmailStatus: string;
    };
  }>('/api/enquiries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchEnquiryActionDetails(token: string) {
  return requestJson<{
    action_type: 'customer_confirm' | 'admin_confirm';
    already_used: boolean;
    expired: boolean;
    enquiry: {
      enquiry_code: string;
      trip_title: string;
      full_name: string;
      departure_date: string;
      adults: number;
      children: number;
      total_travellers: number;
      package_type: string;
      pickup_location: string;
      status: string;
      customer_confirmed: boolean;
    };
  }>(`/api/enquiry-action?token=${encodeURIComponent(token)}`);
}

export function executeEnquiryAction(token: string) {
  return requestJson<{
    ok: boolean;
    action_type: 'customer_confirm' | 'admin_confirm';
    enquiry_code: string;
    status: string;
    customer_confirmed: boolean;
    adminNotified?: boolean;
    adminEmailStatus?: string;
    customerEmailed?: boolean;
    customerEmailStatus?: string;
  }>('/api/enquiry-action', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function submitContactMessage(payload: {
  name: string;
  mobile: string;
  email: string;
  subject: string;
  message: string;
}) {
  return requestJson<{ ok: boolean; message: string }>('/api/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function subscribeNewsletter(email: string) {
  return requestJson<{ ok: boolean; message: string }>('/api/newsletter', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// Admin API helpers (token passed from React memory only)
export function getAuthStatus(token?: string | null) {
  return requestJson<{
    hasAdminAccount: boolean;
    envPasscodeConfigured: boolean;
    needsSetup: boolean;
    authenticated: boolean;
    user: { username: string; displayName: string; role: string } | null;
  }>('/api/admin/auth-status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function bootstrapAdminAccount(payload: {
  username: string;
  displayName: string;
  email?: string;
  password: string;
}) {
  return requestJson<{
    token: string;
    user: { username: string; displayName: string; role: string };
  }>('/api/admin/bootstrap', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginAdmin(payload: { username: string; password: string }) {
  return requestJson<{
    token: string;
    user: { username: string; displayName: string; role: string };
  }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestAdminPasswordReset(identifier: string) {
  return requestJson<{ ok: boolean; smtpConfigured: boolean; message: string }>(
    '/api/admin/request-password-reset',
    {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }
  );
}

export function resetAdminPasswordWithToken(payload: { token: string; newPassword: string }) {
  return requestJson<{ ok: boolean; message: string }>('/api/admin/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function changeAdminPassword(
  token: string,
  payload: { currentPassword: string; newPassword?: string; recoveryEmail?: string }
) {
  return requestJson<{ ok: boolean; adminEmail: string; message: string }>('/api/admin/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminDashboard(token: string) {
  return requestJson<{
    trips: TripPackage[];
    enquiries: CustomerEnquiry[];
    gallery: DestinationImage[];
    testimonials: Testimonial[];
    instagramPosts: InstagramPost[];
    faqs: FaqItem[];
    settings: SiteSettings;
    contactMessages: Array<{
      id: number;
      name: string;
      mobile: string;
      email: string;
      subject: string;
      message: string;
      created_at: string;
    }>;
    newsletterCount: number;
    emailNotifications: EmailNotificationLog[];
    smtpConfigured: boolean;
    adminEmail: string;
  }>('/api/admin/dashboard-data', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function uploadAdminImage(token: string, dataUrl: string) {
  return requestJson<{ url: string }>('/api/admin/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dataUrl }),
  });
}

export function createTrip(token: string, payload: Partial<TripPackage>) {
  return requestJson<{ id: number; trips: TripPackage[] }>('/api/admin/trips', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function updateTrip(token: string, id: number, payload: Partial<TripPackage>) {
  return requestJson<{ trips: TripPackage[] }>(`/api/admin/trips/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteTrip(token: string, id: number) {
  return requestJson<{ trips: TripPackage[] }>(`/api/admin/trips/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateEnquiryStatus(
  token: string,
  id: number,
  status: EnquiryStatus,
  admin_notes: string,
  notifyCustomer = false
) {
  return requestJson<{
    enquiries: CustomerEnquiry[];
    emailNotifications?: EmailNotificationLog[];
    customerEmailStatus?: string;
  }>(`/api/admin/enquiries/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, admin_notes, notifyCustomer }),
  });
}

export function sendAdminTestEmail(token: string, recipientEmail?: string) {
  return requestJson<{
    recipient: string;
    deliveryStatus: string;
    errorMessage: string;
    smtpConfigured: boolean;
    emailNotifications: EmailNotificationLog[];
  }>('/api/admin/test-email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipientEmail }),
  });
}

export function addGalleryImage(
  token: string,
  payload: { trip_id: number | null; destination_name: string; image_url: string; caption: string }
) {
  return requestJson<{ gallery: DestinationImage[]; trips: TripPackage[] }>('/api/admin/gallery', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteGalleryImage(token: string, id: number) {
  return requestJson<{ gallery: DestinationImage[]; trips: TripPackage[] }>(`/api/admin/gallery/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addInstagramPost(
  token: string,
  payload: { image_url: string; caption: string; post_url: string; tag: string }
) {
  return requestJson<{ instagramPosts: InstagramPost[] }>('/api/admin/instagram', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteInstagramPost(token: string, id: number) {
  return requestJson<{ instagramPosts: InstagramPost[] }>(`/api/admin/instagram/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addTestimonial(
  token: string,
  payload: { customer_name: string; city: string; trip_name: string; quote: string; rating: number; is_demo: boolean }
) {
  return requestJson<{ testimonials: Testimonial[] }>('/api/admin/testimonials', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteTestimonial(token: string, id: number) {
  return requestJson<{ testimonials: Testimonial[] }>(`/api/admin/testimonials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addFaqItem(token: string, payload: { question: string; answer: string }) {
  return requestJson<{ faqs: FaqItem[] }>('/api/admin/faqs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteFaqItem(token: string, id: number) {
  return requestJson<{ faqs: FaqItem[] }>(`/api/admin/faqs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function updateSiteSettings(token: string, settings: SiteSettings) {
  return requestJson<{ settings: SiteSettings }>('/api/admin/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings),
  });
}

export function buildWhatsAppUrl(whatsappRaw: string, message: string): string | null {
  const digits = whatsappRaw.replace(/\D/g, '');
  if (!digits || /^0+$/.test(digits) || digits.length < 10) {
    return null;
  }
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function formatINR(amount: number | null): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'Confirm with Operator';
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}
