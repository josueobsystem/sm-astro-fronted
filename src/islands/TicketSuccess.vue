<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, formatMoney, formatTime } from '@/lib/api';
import { truncateWords } from '@/lib/text';
import type { CheckoutSuccessPayload, CheckoutTicket } from '@/types/api';

const props = defineProps<{
  payload: CheckoutSuccessPayload;
  apiBaseUrl: string;
}>();

const hasError = computed(() => Boolean(props.payload.error?.message));
const tickets = computed(() => Array.isArray(props.payload.tickets) ? props.payload.tickets : []);
const customerName = computed(() => props.payload.order?.customer_name || 'Cliente');
const orderNumber = computed(() => props.payload.order?.purchase_number || props.payload.purchaseNumber || props.payload.order?.id?.slice(0, 8) || '-');

function pick(ticket: CheckoutTicket, keys: Array<keyof CheckoutTicket>, fallback = '-') {
  for (const key of keys) {
    const value = ticket[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }

  return fallback;
}

function downloadTicket(ticket: CheckoutTicket) {
  const pdfUrl = pick(ticket, ['pdf_url', 'pdfUrl'], '');
  window.open(pdfUrl || `${props.apiBaseUrl}/api/orders/tickets/${ticket.id}/pdf`, '_blank', 'noopener');
}

function ticketEventTitle(ticket: CheckoutTicket): string {
  return truncateWords(pick(ticket, ['event_name', 'eventTitle'], 'Evento'), 20);
}
</script>

<template>
  <section class="success-panel">
    <template v-if="hasError">
      <div class="success-badge success-badge--error" aria-hidden="true">
        <svg class="success-check" viewBox="0 0 72 72" fill="none">
          <circle class="success-check-bg" cx="36" cy="36" r="34" />
          <path class="success-check-path" d="M24 24L48 48" />
          <path class="success-check-path" d="M48 24L24 48" />
        </svg>
      </div>

      <p class="eyebrow">Checkout</p>
      <h1>No pudimos completar tu compra.</h1>
      <p class="lead">{{ payload.error?.message }}</p>
      <div class="ticket-list">
        <article class="ticket-preview">
          <div>
            <strong>{{ payload.error?.code }}</strong>
            <div class="meta-line">Referencia: {{ payload.error?.reference || '-' }}</div>
          </div>
          <div class="footer-actions">
            <a v-if="payload.error?.retry_url" class="cta-button" :href="payload.error.retry_url">Reintentar pago</a>
            <a class="ghost-button" href="/">Volver al inicio</a>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="success-badge" aria-hidden="true">
        <span class="success-pulse pulse-one"></span>
        <span class="success-pulse pulse-two"></span>
        <svg class="success-check" viewBox="0 0 72 72" fill="none">
          <circle class="success-check-bg" cx="36" cy="36" r="34" />
          <circle class="success-check-ring" cx="36" cy="36" r="28" />
          <path class="success-check-path" d="M22 37.5L32 47.5L50 27.5" />
        </svg>
      </div>

      <p class="eyebrow">Pago confirmado</p>
      <h1>Tus entradas están listas.</h1>
      <p class="lead">
        Gracias por tu compra, <strong>{{ customerName }}</strong>. Hemos preparado tus tickets para descarga.
      </p>

      <div class="ticket-list">
        <article class="ticket-preview">
          <div>
            <strong>Orden {{ orderNumber }}</strong>
            <div class="meta-line">
              {{ formatDate(payload.order?.created_at) }} · {{ formatMoney(payload.order?.total_amount) }}
            </div>
          </div>
          <a class="ghost-button" href="/">Comprar más</a>
        </article>

        <article v-for="ticket in tickets" :key="ticket.id" class="ticket-preview">
          <div>
            <strong>{{ ticketEventTitle(ticket) }}</strong>
            <div class="meta-line">
              {{ formatDate(pick(ticket, ['event_start_at', 'eventStartAt'], '')) }}
              {{ formatTime(pick(ticket, ['event_start_at', 'eventStartAt'], '')) }}
              · {{ pick(ticket, ['ticket_type', 'ticketTypeName'], 'General') }}
              · #{{ pick(ticket, ['ticket_number', 'ticketNumber'], '-') }}
            </div>
          </div>
          <button class="cta-button" type="button" @click="downloadTicket(ticket)">Descargar</button>
        </article>
      </div>
    </template>
  </section>
</template>
