export type ApiEnvelope<T> = {
  status: 'success' | 'error';
  message: string | null;
  data: T | null;
  validations?: Record<string, unknown>;
};

export type PublicEvent = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  banner_sm_url: string | null;
  venue_address: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  min_price: number | null;
  currency: string;
  url: string;
  tickets?: PublicTicket[];
  artists?: PublicArtist[];
};

export type PublicTicket = {
  id: string;
  event_id: string;
  zone_id: string | null;
  zone_name: string | null;
  name: string;
  price: number;
  currency: string;
  stock_total: number;
  stock_sold: number;
  stock_available: number;
  processing_fee_amount: number;
  final_price: number;
  commission_rate_percentage: number;
  is_active: boolean;
  sales_start_at: string | null;
  sales_end_at: string | null;
};

export type PublicArtist = {
  id: string;
  name: string;
  image_url: string | null;
  is_headliner: boolean;
  schedule_at: string | null;
  sort_order: number | null;
};

export type HomeSlide = {
  image: string;
  image_sm: string;
  alt: string;
  title: string | null;
  subtitle: string | null;
  focus_keyword: string | null;
  seo_description: string | null;
  cta_label: string | null;
  cta_url: string | null;
  autoplay_delay_seconds: number;
};

export type HomePayload = {
  slides: HomeSlide[];
  venues: Array<{
    name: string;
    subtitle: string;
    description: string;
    type: string;
    icon: string;
    link: string;
  }>;
  events: PublicEvent[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  seo: {
    title: string;
    description: string;
  };
};

export type CheckoutTicket = {
  id: string;
  ticket_number?: string;
  ticketNumber?: string;
  event_name?: string;
  eventTitle?: string;
  event_start_at?: string;
  eventStartAt?: string;
  ticket_type?: string;
  ticketTypeName?: string;
  pdf_url?: string | null;
  pdfUrl?: string | null;
};

export type ReservationItem = {
  name?: string | null;
  quantity: number;
  price?: number;
  total_price?: number;
  currency?: string | null;
  processing_fee_amount?: number | null;
  processing_fee_label?: string | null;
  processing_fee_rate_label?: string | null;
};

export type CheckoutReservation = {
  id: string;
  event_id?: string | null;
  session_id: string;
  items: ReservationItem[];
  expires_at: string;
};

export type CheckoutTransaction = {
  status?: 'approved' | 'denied' | string | null;
  purchase_number?: string | null;
  customer_name?: string | null;
  transaction_date?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  product_description?: string | null;
  card?: string | null;
  brand?: string | null;
  payment_method?: 'card' | 'yape' | string | null;
  yape_id?: string | null;
  action_description?: string | null;
};

export type CheckoutSuccessPayload = {
  order: {
    id: string;
    purchase_number?: string | null;
    customer_name?: string | null;
    total_amount?: number | string | null;
    created_at?: string | null;
  } | null;
  tickets: CheckoutTicket[];
  purchaseNumber?: string | null;
  flowId?: string | null;
  transaction?: CheckoutTransaction | null;
  error?: {
    message: string;
    code: string;
    reservation_id?: string | null;
    purchase_number?: string | null;
    retry_url?: string | null;
    transaction?: CheckoutTransaction | null;
  } | null;
};
