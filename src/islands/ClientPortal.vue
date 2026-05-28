<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AuthUser } from '@/lib/auth';

type Ticket = {
  id: string;
  ticket_number?: string | null;
  event_name?: string | null;
  event_date?: string | null;
  ticket_type?: string | null;
  price?: number | string | null;
  status?: string | null;
  pdf_url?: string | null;
  qr_pdf_status?: string | null;
  document_type?: string | null;
  document_status?: string | null;
  document_pdf_url?: string | null;
  purchased_at?: string | null;
};

type ReservationItem = {
  name?: string | null;
  quantity?: number;
  price?: number;
  total_price?: number;
  currency?: string | null;
};

type Reservation = {
  id: string;
  event_id?: string | null;
  session_id?: string | null;
  items?: ReservationItem[];
  expires_at?: string | null;
  status?: string | null;
};

type ServiceRequest = {
  id: string;
  event_type?: string | null;
  status?: string | null;
  status_label?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  venue_address?: string | null;
  description?: string | null;
  reason?: string | null;
  location_label?: string | null;
  created_at?: string | null;
  contract?: {
    code?: string | null;
    status?: string | null;
    sign_token?: string | null;
    signed_at?: string | null;
    client_signature_url?: string | null;
  } | null;
};

type PortalData = {
  auth?: {
    user?: AuthUser | null;
  };
  tickets?: Ticket[];
  reservations?: Reservation[];
  serviceRequests?: ServiceRequest[];
};

const props = defineProps<{
  initialUser: AuthUser;
  initialTab?: string;
}>();

const validTabs = ['profile', 'tickets', 'reservations', 'service-requests'];
const activeTab = ref(validTabs.includes(props.initialTab || '') ? props.initialTab || 'profile' : 'profile');
const loading = ref(true);
const error = ref<string | null>(null);
const portal = ref<PortalData>({
  auth: { user: props.initialUser },
  tickets: [],
  reservations: [],
  serviceRequests: [],
});

const user = computed(() => portal.value.auth?.user || props.initialUser);
const tickets = computed(() => portal.value.tickets ?? []);
const reservations = computed(() => portal.value.reservations ?? []);
const serviceRequests = computed(() => portal.value.serviceRequests ?? []);
const avatarUrl = computed(() => {
  const photoUrl = user.value.profile_photo_url || '';
  if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
    return photoUrl;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.value.name || 'Cliente')}&size=256&background=ec4899&color=ffffff&bold=true`;
});

const tabs = computed(() => [
  { id: 'profile', name: 'Información del Perfil', icon: 'user' },
  { id: 'tickets', name: 'Mis Entradas', icon: 'ticket', count: tickets.value.length },
  { id: 'reservations', name: 'Mis Reservas', icon: 'bookmark', count: reservations.value.length },
  { id: 'service-requests', name: 'Mis Solicitudes', icon: 'clipboard', count: serviceRequests.value.length },
]);

function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem('sm_ticket_session_id') || '';
}

async function loadPortal() {
  loading.value = true;
  error.value = null;

  try {
    const url = new URL('/api/client/portal', window.location.origin);
    const sessionId = getSessionId();

    if (sessionId) {
      url.searchParams.set('session_id', sessionId);
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    const envelope = await response.json();

    if (!response.ok || envelope.status === 'error') {
      throw new Error(envelope.message || 'No se pudo cargar tu portal.');
    }

    portal.value = envelope.data || portal.value;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'No se pudo cargar tu portal.';
  } finally {
    loading.value = false;
  }
}

function selectTab(tabId: string) {
  activeTab.value = tabId;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tabId);
  window.history.replaceState({}, '', url);
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value?: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

function formatMoney(value?: number | string | null) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function ticketStatusLabel(status?: string | null) {
  const normalized = String(status || 'VALID').toUpperCase();
  const labels: Record<string, string> = {
    VALID: 'Válida',
    USED: 'Usada',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
  };

  return labels[normalized] || normalized;
}

function reservationTotal(reservation: Reservation) {
  return (reservation.items ?? []).reduce((sum, item) => {
    return sum + Number(item.total_price ?? item.price ?? 0) * Number(item.quantity || 0);
  }, 0);
}

function checkoutUrl(reservation: Reservation) {
  const sessionId = reservation.session_id || getSessionId();

  if (!sessionId || !reservation.id) {
    return '';
  }

  return `/checkout/${encodeURIComponent(sessionId)}?reservation_id=${encodeURIComponent(reservation.id)}`;
}

function downloadTicket(ticket: Ticket) {
  window.open(ticket.pdf_url || `/api/orders/tickets/${encodeURIComponent(ticket.id)}/pdf`, '_blank');
}

function downloadDocument(ticket: Ticket) {
  if (ticket.document_pdf_url) {
    window.open(ticket.document_pdf_url, '_blank');
  }
}

function documentLabel(ticket: Ticket) {
  const type = String(ticket.document_type || 'BOLETA').toUpperCase();
  return type === 'FACTURA' ? 'Factura' : 'Boleta';
}

onMounted(() => {
  loadPortal();
});
</script>

<template>
  <section class="client-portal">
    <div class="client-profile-hero">
      <div class="client-profile-gradient"></div>
      <div class="client-profile-content">
        <img class="client-profile-avatar" :src="avatarUrl" :alt="user.name" />
        <div>
          <h1>{{ user.name }}</h1>
          <p>{{ user.email }}</p>
        </div>
      </div>
    </div>

    <div v-if="error" class="portal-alert">
      <strong>No pudimos cargar todo el portal.</strong>
      <span>{{ error }}</span>
      <button type="button" @click="loadPortal">Reintentar</button>
    </div>

    <div class="portal-layout">
      <aside class="portal-tabs-card">
        <nav class="portal-tabs" aria-label="Portal del cliente">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="portal-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            @click="selectTab(tab.id)"
          >
            <span class="portal-tab-icon">{{ tab.icon }}</span>
            <span>{{ tab.name }}</span>
            <strong v-if="typeof tab.count === 'number'">{{ tab.count }}</strong>
          </button>
        </nav>
      </aside>

      <div class="portal-panel">
        <div v-if="loading" class="portal-loading">
          <span></span>
          <p>Cargando tu información...</p>
        </div>

        <div v-else-if="activeTab === 'profile'" class="portal-card">
          <div class="portal-section-head">
            <div>
              <p>Perfil</p>
              <h2>Información del Perfil</h2>
            </div>
          </div>
          <div class="profile-info-grid">
            <div>
              <span>Nombre</span>
              <strong>{{ user.name }}</strong>
            </div>
            <div>
              <span>Correo electrónico</span>
              <strong>{{ user.email }}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>{{ user.person?.phone || 'No registrado' }}</strong>
            </div>
            <div>
              <span>Documento</span>
              <strong>{{ user.person?.document_number || 'No registrado' }}</strong>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'tickets'" class="portal-card">
          <div class="portal-section-head">
            <div>
              <p>Compras</p>
              <h2>Mis Entradas</h2>
            </div>
            <span>{{ tickets.length }} entradas</span>
          </div>

          <div v-if="tickets.length === 0" class="portal-empty">
            <h3>Aún no tienes entradas</h3>
            <p>Explora nuestros próximos eventos y compra tus entradas oficiales.</p>
            <a href="/">Ver Eventos</a>
          </div>

          <div v-else class="portal-table-wrap">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Fecha / Hora</th>
                  <th>Entrada</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ticket in tickets" :key="ticket.id">
                  <td>
                    <strong>{{ ticket.event_name || 'Evento' }}</strong>
                    <small v-if="ticket.purchased_at">Compra: {{ formatDate(ticket.purchased_at) }} {{ formatTime(ticket.purchased_at) }}</small>
                  </td>
                  <td>
                    {{ formatDate(ticket.event_date) }}
                    <small>{{ formatTime(ticket.event_date) }}</small>
                  </td>
                  <td>
                    <span class="portal-pill">{{ ticket.ticket_type || 'General' }}</span>
                    <small>#{{ ticket.ticket_number || '-' }} · {{ formatMoney(ticket.price) }}</small>
                  </td>
                  <td>
                    <span class="portal-status">{{ ticketStatusLabel(ticket.status) }}</span>
                  </td>
                  <td>
                    <div class="portal-actions">
                      <button type="button" @click="downloadTicket(ticket)">
                        {{ ticket.qr_pdf_status === 'pending' ? 'Generar QR' : 'Descargar QR' }}
                      </button>
                      <button
                        v-if="ticket.document_pdf_url"
                        type="button"
                        class="is-secondary"
                        @click="downloadDocument(ticket)"
                      >
                        Descargar {{ documentLabel(ticket) }}
                      </button>
                      <span v-else class="portal-doc-pending">
                        {{ documentLabel(ticket) }} pendiente
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="activeTab === 'reservations'" class="portal-card">
          <div class="portal-section-head">
            <div>
              <p>Reservas activas</p>
              <h2>Mis Reservas</h2>
            </div>
            <span>{{ reservations.length }} reservas</span>
          </div>

          <div v-if="reservations.length === 0" class="portal-empty">
            <h3>No tienes reservas activas</h3>
            <p>Cuando reserves entradas antes de pagar, aparecerán aquí para que puedas continuar el checkout.</p>
            <a href="/">Reservar Entradas</a>
          </div>

          <div v-else class="reservation-grid">
            <article v-for="reservation in reservations" :key="reservation.id" class="reservation-card">
              <div>
                <p>Reserva</p>
                <h3>#{{ reservation.id.slice(0, 8).toUpperCase() }}</h3>
              </div>
              <div class="reservation-items">
                <span v-for="item in reservation.items || []" :key="`${reservation.id}-${item.name}-${item.quantity}`">
                  {{ item.quantity || 0 }} x {{ item.name || 'Entrada' }}
                </span>
              </div>
              <div class="reservation-meta">
                <span>Expira: {{ formatDate(reservation.expires_at) }} {{ formatTime(reservation.expires_at) }}</span>
                <strong>{{ formatMoney(reservationTotal(reservation)) }}</strong>
              </div>
              <a v-if="checkoutUrl(reservation)" :href="checkoutUrl(reservation)">Continuar Checkout</a>
            </article>
          </div>
        </div>

        <div v-else class="portal-card">
          <div class="portal-section-head">
            <div>
              <p>Servicios</p>
              <h2>Mis Solicitudes de Servicio</h2>
            </div>
            <span>{{ serviceRequests.length }} solicitudes</span>
          </div>

          <div v-if="serviceRequests.length === 0" class="portal-empty">
            <h3>Aún no tienes solicitudes</h3>
            <p>Cuando registres una solicitud de servicio, podrás seguir su estado desde aquí.</p>
            <a href="/#solicitud-evento">Nueva Solicitud</a>
          </div>

          <div v-else class="request-grid">
            <article v-for="request in serviceRequests" :key="request.id" class="request-card">
              <div>
                <h3>{{ request.event_type || 'Solicitud' }}</h3>
                <span>{{ request.status_label || request.status || 'Sin estado' }}</span>
              </div>
              <p>{{ formatDate(request.event_date) }} · {{ request.start_time || '--:--' }} - {{ request.end_time || '--:--' }}</p>
              <p>{{ request.location_label || request.venue_address || 'Ubicación pendiente' }}</p>
              <small>{{ request.reason || request.description || 'Sin detalle adicional.' }}</small>
              <a v-if="request.contract?.sign_token" :href="`/contracts/preview/${request.contract.sign_token}`" target="_blank">
                Ver Documento
              </a>
            </article>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
