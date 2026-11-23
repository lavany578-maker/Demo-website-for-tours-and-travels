export type PackageStatus = 'Upcoming' | 'Booking Open' | 'Filling Fast' | 'Fully Booked';

export type PackageType = 'Individual' | 'Couple' | 'Family / Group';

export type EnquiryStatus = 'New' | 'Contacted' | 'Confirmed' | 'Cancelled';

export interface ItineraryDay {
  id?: number;
  trip_id?: number;
  day_number: number;
  title: string;
  location: string;
  description: string;
  meals: string;
  stay: string;
  highlights: string[];
}

export interface DestinationImage {
  id: number;
  trip_id: number | null;
  destination_name: string;
  image_url: string;
  caption: string;
  sort_order: number;
  created_at?: string;
}

export interface TripPackage {
  id: number;
  slug: string;
  title: string;
  destination: string;
  subtitle: string;
  summary: string;
  cover_image: string;
  start_date: string;
  return_date: string;
  days: number;
  nights: number;
  price_per_person: number | null;
  couple_price: number | null;
  available_seats: number | null;
  departure_location: string;
  status: PackageStatus;
  is_verified: boolean;
  price_note: string;
  hotel_info: string;
  food_info: string;
  transport_info: string;
  inclusions: string[];
  exclusions: string[];
  instructions: string[];
  latitude: number | null;
  longitude: number | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  itinerary: ItineraryDay[];
  gallery: DestinationImage[];
}

export interface CustomerEnquiry {
  id: number;
  enquiry_code: string;
  trip_id: number | null;
  trip_title: string;
  full_name: string;
  mobile: string;
  email: string;
  departure_date: string;
  adults: number;
  children: number;
  total_travellers: number;
  package_type: PackageType;
  pickup_location: string;
  requirements: string;
  status: EnquiryStatus;
  customer_confirmed: boolean;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface EmailNotificationLog {
  id: number;
  enquiry_id: number | null;
  recipient_email: string;
  notification_type: 'admin_new_enquiry' | 'admin_customer_confirmed' | 'customer_request_confirm' | 'customer_booking_confirmed' | 'admin_password_reset' | 'test_email';
  subject: string;
  body_text: string;
  action_url: string;
  delivery_status: 'sent' | 'smtp_unconfigured' | 'failed';
  error_message: string;
  created_at: string;
}

export interface Testimonial {
  id: number;
  customer_name: string;
  city: string;
  trip_name: string;
  quote: string;
  rating: number;
  is_demo: boolean;
  is_published: boolean;
  created_at?: string;
}

export interface InstagramPost {
  id: number;
  image_url: string;
  caption: string;
  post_url: string;
  tag: string;
  created_at?: string;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
}

export interface SiteSettings {
  businessName: string;
  tagline: string;
  mobile: string;
  whatsapp: string;
  email: string;
  adminNotificationEmail: string;
  officeAddress: string;
  officeLat: number;
  officeLng: number;
  instagramHandle: string;
  instagramUrl: string;
  completedTours: number | null;
  happyTravellers: number | null;
  statsVerified: boolean;
  contactVerified: boolean;
  cancellationPolicy: string;
}

export interface PublicBootstrapData {
  trips: TripPackage[];
  gallery: DestinationImage[];
  testimonials: Testimonial[];
  instagramPosts: InstagramPost[];
  faqs: FaqItem[];
  settings: SiteSettings;
  mapsApiKeyConfigured: boolean;
  mapsApiKey: string;
}

export interface WeatherResponse {
  configured: boolean;
  available: boolean;
  reason?: string;
  temperatureCelsius?: number;
  feelsLikeCelsius?: number;
  conditionText?: string;
  humidity?: number;
  windKmh?: number;
  observedAt?: string;
}
