<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, formatMoney, formatTime } from '@/lib/api';
import { truncateWords } from '@/lib/text';
import type { CheckoutSuccessPayload, CheckoutTicket, CheckoutTransaction } from '@/types/api';

const props = defineProps<{
  payload: CheckoutSuccessPayload;
  apiBaseUrl: string;
}>();

const hasError = computed(() => Boolean(props.payload.error?.message));
const tickets = computed(() => Array.isArray(props.payload.tickets) ? props.payload.tickets : []);
const orderNumber = computed(() => props.payload.order?.purchase_number || props.payload.purchaseNumber || props.payload.order?.id?.slice(0, 8) || '-');
const transaction = computed<CheckoutTransaction | null>(() => props.payload.transaction || props.payload.error?.transaction || null);
const transactionCustomerName = computed(() => transaction.value?.customer_name || props.payload.order?.customer_name || null);
const deniedActionDescription = computed(() => transaction.value?.action_description || props.payload.error?.message || 'No pudimos procesar tu pago.');
const isYapePayment = computed(() => {
  const selectedMethod = `${transaction.value?.payment_method || ''}`.trim().toLowerCase();
  if (selectedMethod === 'yape') {
    return true;
  }

  if (['card', 'card_local', 'card_intl'].includes(selectedMethod)) {
    return false;
  }

  const method = `${selectedMethod} ${transaction.value?.brand || ''}`;

  return Boolean(transaction.value?.yape_id) || /yape/i.test(method);
});
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
  window.open(pdfUrl || `/api/orders/tickets/${encodeURIComponent(ticket.id)}/pdf`, '_blank', 'noopener');
}

function ticketEventTitle(ticket: CheckoutTicket): string {
  return truncateWords(pick(ticket, ['event_name', 'eventTitle'], 'Evento'), 20);
}

function transactionDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatDate(value)} · ${formatTime(value)}`;
}

function transactionAmount(value: number | string | null | undefined, currency: string | null | undefined): string {
  const currencyLabel = currency === 'PEN' || !currency ? 'S/' : currency;

  return formatMoney(value, currencyLabel);
}
</script>

<template>
  <section class="success-panel">
    <template v-if="hasError">
      <article class="checkout-result-ticket checkout-result-ticket--denied">
        <header class="checkout-result-ticket__header">
          <div>
            <p class="checkout-result-ticket__eyebrow">Sonia Morales · Checkout</p>
            <h1>Detalle de pago</h1>
          </div>
          <span class="checkout-result-ticket__status">Pago denegado</span>
        </header>

        <div class="checkout-result-ticket__hero">
          <div class="checkout-result-ticket__icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" />
              <path d="m17 17 14 14M31 17 17 31" />
            </svg>
          </div>
          <div>
            <p class="checkout-result-ticket__label">Resultado de la transacción</p>
            <h2>No pudimos aprobar tu pago.</h2>
            <p>{{ deniedActionDescription }}</p>
          </div>
        </div>

        <div class="checkout-result-ticket__tear" aria-hidden="true"></div>

        <div class="checkout-result-ticket__body">
          <dl class="checkout-result-ticket__details">
            <div>
              <dt>Número de pedido</dt>
              <dd>{{ transaction?.purchase_number || orderNumber }}</dd>
            </div>
            <div v-if="transaction?.transaction_date">
              <dt>Fecha y hora del pedido</dt>
              <dd>{{ transactionDate(transaction.transaction_date) }}</dd>
            </div>
            <div v-if="isYapePayment && transaction?.yape_id">
              <dt>Operación Yape</dt>
              <dd>{{ transaction.yape_id }}</dd>
            </div>
          </dl>

          <p class="checkout-result-ticket__help">
            No se realizó ningún cargo si el pago fue denegado. Si detectas un cobro, conserva este detalle y contáctanos.
          </p>
        </div>

        <footer class="checkout-result-ticket__footer">
          <div class="footer-actions">
            <a v-if="payload.error?.retry_url" class="cta-button" :href="payload.error.retry_url">Reintentar pago</a>
            <a class="ghost-button" href="/">Volver a eventos</a>
          </div>
        </footer>
      </article>
    </template>

    <template v-else>
      <article class="checkout-result-ticket checkout-result-ticket--approved">
        <header class="checkout-result-ticket__header">
          <div>
            <p class="checkout-result-ticket__eyebrow">Sonia Morales · Checkout</p>
            <h1>Detalle de compra</h1>
          </div>
          <span class="checkout-result-ticket__status">Pago aprobado</span>
        </header>

        <div class="checkout-result-ticket__hero">
          <div class="checkout-result-ticket__icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" />
              <path d="m15 24 6 6 12-13" />
            </svg>
          </div>
          <div>
            <p class="checkout-result-ticket__label">Resultado de la transacción</p>
            <h2>Tu compra fue confirmada.</h2>
            <p>Pago aprobado y procesado correctamente.</p>
          </div>
        </div>

        <div class="checkout-result-ticket__tear" aria-hidden="true"></div>

        <div class="checkout-result-ticket__body">
          <dl class="checkout-result-ticket__details">
            <div>
              <dt>Número de pedido</dt>
              <dd>{{ transaction?.purchase_number || orderNumber }}</dd>
            </div>
            <div v-if="transactionCustomerName">
              <dt>Usuario</dt>
              <dd>{{ transactionCustomerName }}</dd>
            </div>
            <div>
              <dt>Fecha y hora del pedido</dt>
              <dd>{{ transactionDate(transaction?.transaction_date || payload.order?.created_at) }}</dd>
            </div>
            <div>
              <dt>Importe de la transacción</dt>
              <dd>{{ transactionAmount(transaction?.amount || payload.order?.total_amount, transaction?.currency || 'PEN') }}</dd>
            </div>
            <div v-if="transaction?.product_description">
              <dt>Producto(s)</dt>
              <dd>{{ transaction.product_description }}</dd>
            </div>
            <div v-if="isYapePayment && transaction?.yape_id">
              <dt>Operación Yape</dt>
              <dd>{{ transaction.yape_id }}</dd>
            </div>
          </dl>

          <p class="checkout-result-ticket__help">Conserva este comprobante como detalle de tu compra.</p>
        </div>
      </article>

      <div v-if="tickets.length" class="ticket-list">
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
