<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AuthForm from '@/islands/AuthForm.vue';
import { formatMoney } from '@/lib/api';
import type { PublicTicket } from '@/types/api';

const props = defineProps<{
  apiBaseUrl: string;
  eventId: string;
  tickets: PublicTicket[];
  initialAuthenticated: boolean;
  loginUrl: string;
}>();

const quantities = reactive<Record<string, number>>({});
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const isAuthenticated = ref(Boolean(props.initialAuthenticated));
const loginModalOpen = ref(false);
const authMode = ref<'login' | 'register'>('login');
const isMounted = ref(false);

const activeTickets = computed(() => props.tickets.filter((ticket) => {
  return ticket.is_active && Number(ticket.stock_available || 0) > 0;
}));
const selectedItems = computed(() => activeTickets.value
  .map((ticket) => ({
    ticket_type_id: ticket.id,
    quantity: quantities[ticket.id] || 0,
  }))
  .filter((item) => item.quantity > 0));
const total = computed(() => activeTickets.value.reduce((sum, ticket) => {
  return sum + Number(ticket.final_price || ticket.price || 0) * Number(quantities[ticket.id] || 0);
}, 0));

const redirectTarget = computed(() => {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}`;
});

function openLoginModal() {
  authMode.value = 'login';
  loginModalOpen.value = true;
}

function closeLoginModal() {
  loginModalOpen.value = false;
}

function handleLoginSuccess() {
  isAuthenticated.value = true;
  closeLoginModal();
  void reserve();
}

function changeAuthMode(mode: 'login' | 'register') {
  authMode.value = mode;
}

function updateQuantity(ticketId: string, delta: number, max: number) {
  const limit = Math.min(Math.max(Number(max || 0), 0), 10);
  const next = Math.min(Math.max((quantities[ticketId] || 0) + delta, 0), limit);
  quantities[ticketId] = next;
}

function getSessionId(): string {
  const existing = window.localStorage.getItem('sm_ticket_session_id');
  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  window.localStorage.setItem('sm_ticket_session_id', next);
  return next;
}

async function reserve() {
  errorMessage.value = null;

  if (!isAuthenticated.value) {
    openLoginModal();
    return;
  }

  if (selectedItems.value.length === 0) {
    errorMessage.value = 'Selecciona al menos una entrada.';
    return;
  }

  loading.value = true;
  const sessionId = getSessionId();

  try {
    const response = await fetch('/api/orders/reservations', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: props.eventId,
        session_id: sessionId,
        items: selectedItems.value,
      }),
    });
    const envelope = await response.json();

    if (!response.ok || envelope.status === 'error') {
      throw new Error(envelope.message || 'No se pudo crear la reserva.');
    }

    const reservationId = envelope.data?.id;
    if (!reservationId) {
      throw new Error('La API no devolvió el identificador de la reserva.');
    }

    window.location.href = `/checkout/${encodeURIComponent(sessionId)}?reservation_id=${encodeURIComponent(reservationId)}`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo crear la reserva.';
  } finally {
    loading.value = false;
  }
}

function onModalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeLoginModal();
  }
}

watch(loginModalOpen, (isOpen) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.toggle('modal-open', isOpen);

  if (isOpen) {
    document.addEventListener('keydown', onModalKeydown);
    return;
  }

  document.removeEventListener('keydown', onModalKeydown);
});

onMounted(() => {
  isMounted.value = true;
});

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onModalKeydown);
});
</script>

<template>
  <section class="ticket-shop">
    <div class="ticket-shop-header">
      <h3 class="ticket-shop-title">Entradas</h3>
      <p class="ticket-shop-subtitle">Elige tus zonas y cantidades sin ruido visual.</p>
    </div>

    <p v-if="activeTickets.length === 0" class="meta-line">
      No hay entradas disponibles para este evento por el momento.
    </p>

    <article v-for="ticket in activeTickets" :key="ticket.id" class="ticket-row">
      <div>
        <p class="ticket-name">{{ ticket.name }}</p>
        <div class="ticket-price">
          {{ formatMoney(ticket.final_price || ticket.price) }}
        </div>
      </div>
      <div class="qty-control">
        <button type="button" @click="updateQuantity(ticket.id, -1, ticket.stock_available)">-</button>
        <strong>{{ quantities[ticket.id] || 0 }}</strong>
        <button type="button" @click="updateQuantity(ticket.id, 1, ticket.stock_available)">+</button>
      </div>
    </article>

    <p v-if="errorMessage" class="checkout-error">{{ errorMessage }}</p>

    <button class="ticket-reserve-button" type="button" :disabled="loading || activeTickets.length === 0" @click="reserve">
      {{ loading ? 'Procesando...' : (isAuthenticated ? 'RESERVAR ENTRADAS' : 'INICIA SESIÓN PARA COMPRAR') }}
    </button>

    <Teleport v-if="isMounted" to="body">
      <div v-if="loginModalOpen" class="event-login-modal" role="dialog" aria-modal="true" :aria-label="authMode === 'register' ? 'Crear una cuenta para continuar' : 'Iniciar sesión para continuar'" @click.self="closeLoginModal">
        <div class="event-login-modal__panel">
          <button class="event-login-modal__close" type="button" aria-label="Cerrar modal de inicio de sesión" @click="closeLoginModal">
            ×
          </button>

          <AuthForm
            :key="authMode"
            :mode="authMode"
            :api-base-url="apiBaseUrl"
            :redirect-to="redirectTarget"
            success-mode="emit"
            :inline-mode="true"
            :allow-mode-switch="true"
            @success="handleLoginSuccess"
            @mode-change="changeAuthMode"
          />

          <p class="event-login-modal__hint">
            ¿Prefieres pantalla completa?
            <a :href="authMode === 'register' ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : loginUrl">
              {{ authMode === 'register' ? 'Ir al registro' : 'Ir al login' }}
            </a>
          </p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
