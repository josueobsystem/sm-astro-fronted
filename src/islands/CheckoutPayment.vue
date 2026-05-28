<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatDate, formatMoney, formatTime } from '@/lib/api';
import type { CheckoutReservation, PublicEvent } from '@/types/api';

const props = defineProps<{
  apiBaseUrl: string;
  siteUrl: string;
  reservation: CheckoutReservation;
  event: PublicEvent | null;
  niubizCheckoutUrl: string;
}>();

const NIUBIZ_MERCHANT_LOGO_PATH = '/niubiz-merchant-logo.png';
const CHECKOUT_BRAND_LOGO_PATH = '/checkout-brand-logo.png';
const DEFAULT_PROCESSING_FEE_LABEL = 'Cargo por procesamiento de pago';
const DEFAULT_PROCESSING_FEE_RATE_LABEL = '3.45% + IGV';
const DEFAULT_PROCESSING_FEE_TOTAL_RATE = 0.0345 * 1.18;

const name = ref('');
const email = ref('');
const phone = ref('');
const billingType = ref<'boleta' | 'factura'>('boleta');
const ruc = ref('');
const razonSocial = ref('');
const direccion = ref('');
const selectedPaymentMethod = ref('card');
const consent = ref(false);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const secondsLeft = ref(secondsUntilExpiration());
let timer: ReturnType<typeof setInterval> | null = null;

const totalTickets = computed(() => props.reservation.items.reduce((sum, item) => {
  return sum + Number(item.quantity || 0);
}, 0));

const ticketLabels = computed(() => props.reservation.items.map((item) => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.price || 0);
  const lineTotal = Number(item.total_price ?? unitPrice * quantity);
  const lineFee = Number(item.processing_fee_amount || 0);

  return {
    label: `${quantity} ${quantity === 1 ? 'entrada' : 'entradas'} - ${item.name || 'Entrada'}`,
    price: lineTotal,
    currency: displayCurrency(item.currency),
    processingFeeAmount: lineFee,
    processingFeeLabel: item.processing_fee_label || DEFAULT_PROCESSING_FEE_LABEL,
    processingFeeRateLabel: item.processing_fee_rate_label || DEFAULT_PROCESSING_FEE_RATE_LABEL,
  };
}));

const concertAmount = computed(() => props.reservation.items.reduce((sum, item) => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.price || 0);
  const lineTotal = Number(item.total_price ?? unitPrice * quantity);

  return sum + lineTotal;
}, 0));

const processingFeeAmount = computed(() => {
  const fromItems = props.reservation.items.reduce((sum, item) => {
    return sum + Number(item.processing_fee_amount || 0);
  }, 0);

  if (fromItems > 0) {
    return roundMoney(fromItems);
  }

  if (concertAmount.value <= 0) {
    return 0;
  }

  return roundMoney(concertAmount.value * DEFAULT_PROCESSING_FEE_TOTAL_RATE);
});

const total = computed(() => concertAmount.value + processingFeeAmount.value);
const timerDisplay = computed(() => {
  const minutes = Math.floor(secondsLeft.value / 60);
  const seconds = secondsLeft.value % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});
const timerUrgent = computed(() => secondsLeft.value <= 60);
const paymentDisabled = computed(() => {
  if (loading.value || !name.value || !email.value) return true;
  if (billingType.value === 'factura') {
    return !/^\d{11}$/.test(ruc.value) || !razonSocial.value || !direccion.value;
  }

  return false;
});

function roundMoney(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function secondsUntilExpiration(): number {
  const diff = Math.floor((new Date(props.reservation.expires_at).getTime() - Date.now()) / 1000);

  return Math.max(0, diff);
}

function formatCompactMoney(value: number | string | null | undefined): string {
  const amount = Number(value || 0);

  return Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
}

function displayCurrency(value: string | null | undefined): string {
  if (!value || value === 'PEN') {
    return 'S/';
  }

  return value;
}

function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Niubiz Checkout.'));
    document.head.appendChild(script);
  });
}

function closeCheckout() {
  window.location.href = '/';
}

function buildFrontendUrl(path: string): string {
  return new URL(path, props.siteUrl).toString();
}

async function startPayment() {
  errorMessage.value = null;

  if (!name.value || !email.value) {
    errorMessage.value = 'Ingresa nombre y correo para continuar.';
    return;
  }

  if (billingType.value === 'factura' && (!/^\d{11}$/.test(ruc.value) || !razonSocial.value || !direccion.value)) {
    errorMessage.value = 'Completa los datos de factura para continuar.';
    return;
  }

  loading.value = true;

  try {
    const response = await fetch(`${props.apiBaseUrl}/api/orders/checkout/session`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservation_id: props.reservation.id,
        customer_email: email.value,
        customer_name: name.value,
        customer_phone: phone.value || null,
        payment_method: selectedPaymentMethod.value,
        billing_type: billingType.value,
        ruc: billingType.value === 'factura' ? ruc.value : null,
        razon_social: billingType.value === 'factura' ? razonSocial.value : null,
        direccion: billingType.value === 'factura' ? direccion.value : null,
      }),
    });
    const envelope = await response.json();

    if (!response.ok || envelope.status === 'error') {
      throw new Error(envelope.message || 'No pudimos iniciar el pago.');
    }

    await loadScript(props.niubizCheckoutUrl);

    const data = envelope.data;
    const successPath = `/checkout/success?reservation_id=${encodeURIComponent(props.reservation.id)}&purchase_number=${encodeURIComponent(data.purchase_number)}&billing_type=${encodeURIComponent(billingType.value)}&payment_method=${encodeURIComponent(selectedPaymentMethod.value)}`;
    const frontendSuccessUrl = buildFrontendUrl(successPath);
    const action = `${props.apiBaseUrl}/orders/checkout/confirm?reservation_id=${encodeURIComponent(props.reservation.id)}&payment_method=${encodeURIComponent(selectedPaymentMethod.value)}&frontend_success_url=${encodeURIComponent(frontendSuccessUrl)}`;

    window.VisanetCheckout.configure({
      sessiontoken: data.session_token,
      channel: 'web',
      merchantid: data.merchant_id,
      purchasenumber: data.purchase_number,
      amount: Number(data.amount),
      merchantlogo: buildFrontendUrl(NIUBIZ_MERCHANT_LOGO_PATH),
      merchantname: 'Sonia Morales',
      timeouturl: buildFrontendUrl('/checkout/timeout'),
      action,
    });
    window.VisanetCheckout.open();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No pudimos iniciar el pago.';
    loading.value = false;
  }
}

onMounted(() => {
  timer = setInterval(() => {
    secondsLeft.value = secondsUntilExpiration();

    if (secondsLeft.value === 0 && timer) {
      clearInterval(timer);
      closeCheckout();
    }
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <div class="checkout-page">
    <div class="checkout-progress-wrap">
      <div class="checkout-progress-shell">
        <div class="checkout-progress-bar">
          <div class="checkout-progress-fill"></div>
        </div>
      </div>
    </div>

    <header class="checkout-header">
      <div class="checkout-header-inner">
        <div class="checkout-step">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Pago</span>
        </div>

        <div class="checkout-timer" :class="{ urgent: timerUrgent }">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="checkout-timer-digits">{{ timerDisplay }}</span>
          <span class="checkout-timer-label">{{ timerUrgent ? '¡Date prisa!' : '¡Tienes tiempo de sobra!' }}</span>
          <button class="checkout-timer-close" type="button" @click="closeCheckout" aria-label="Cerrar checkout">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="checkout-body">
      <div class="checkout-grid">
        <section class="checkout-main">
          <div class="checkout-contact-card">
            <h3>Datos de Contacto</h3>
            <label>
              <span>Nombre Completo</span>
              <input v-model="name" class="checkout-input" placeholder="Tu nombre" />
            </label>
            <label>
              <span>Correo Electrónico</span>
              <input v-model="email" type="email" class="checkout-input" placeholder="tucorreo@ejemplo.com" />
              <small class="meta-line">Aquí enviaremos tus entradas.</small>
            </label>
            <label>
              <span>Teléfono (Opcional)</span>
              <input v-model="phone" class="checkout-input" placeholder="999 999 999" />
            </label>
          </div>

          <div class="billing-wrap">
            <div class="billing-badge">Facturación</div>

            <label class="billing-select-field">
              <span class="field-label">Tipo de comprobante</span>
              <div class="billing-select-wrap">
                <select v-model="billingType" class="billing-select" aria-label="Selecciona tipo de comprobante">
                  <option value="boleta">Boleta</option>
                  <option value="factura">Factura</option>
                </select>
                <svg class="billing-select-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="m7 10 5 5 5-5z" />
                </svg>
              </div>
            </label>
            <p class="billing-helper">Por defecto emitiremos boleta.</p>

            <div v-if="billingType === 'factura'" class="invoice-form">
              <label class="field-group">
                <span class="field-label">RUC *</span>
                <input v-model="ruc" class="checkout-input" maxlength="11" placeholder="Ej: 20123456789" />
              </label>
              <label class="field-group">
                <span class="field-label">Razón Social *</span>
                <input v-model="razonSocial" class="checkout-input" placeholder="Nombre de la empresa" />
              </label>
              <label class="field-group">
                <span class="field-label">Dirección fiscal *</span>
                <input v-model="direccion" class="checkout-input" placeholder="Av. Ejemplo 123, Lima" />
              </label>
            </div>

            <div class="billing-note">
              <p>
                Las entradas son vendidas por nuestra empresa, por lo que recibirás un Comprobante de Pago
                (boleta o factura) por el monto total de tu compra.
              </p>
              <p>Para descargar tu {{ billingType === 'boleta' ? 'Boleta' : 'Factura' }} ingresa a <strong>"MIS ENTRADAS"</strong></p>
            </div>
          </div>

          <div class="payment-selector">
            <h2>Selecciona Cómo Pagar</h2>
            <p class="payment-subtitle">Elige el método de pago para tu compra.</p>

            <label class="consent-label">
              <input v-model="consent" type="checkbox" />
              <span>
                Doy mi <a href="#" class="consent-link">consentimiento para usos adicionales</a>
                y disfrutar de los beneficios, promociones y descuentos creados para mí.
              </span>
            </label>

            <button
              class="method-item selected"
              type="button"
              @click="selectedPaymentMethod = 'card'"
            >
              <span class="method-left">
                <span class="method-brand-logo-wrap">
                  <img :src="CHECKOUT_BRAND_LOGO_PATH" alt="Logo Sonia Morales" class="method-brand-logo" />
                </span>
                <span class="method-label">Pago online (Tarjetas, Yape y más)</span>
              </span>
              <span class="method-logos">
                <span class="logo-svg" title="Yape">
                  <svg viewBox="0 0 56 26" aria-hidden="true">
                    <rect x="1" y="1" width="54" height="24" rx="7" fill="#7428d9" />
                    <text x="28" y="17" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">yape</text>
                  </svg>
                </span>
                <span class="logo-svg" title="Visa">
                  <svg viewBox="0 0 56 26" aria-hidden="true">
                    <rect x="1" y="1" width="54" height="24" rx="7" fill="#ffffff" stroke="#d1d5db" />
                    <text x="28" y="17" fill="#1a1f71" font-size="10" font-weight="800" text-anchor="middle">VISA</text>
                  </svg>
                </span>
                <span class="logo-svg" title="Mastercard">
                  <svg viewBox="0 0 56 26" aria-hidden="true">
                    <rect x="1" y="1" width="54" height="24" rx="7" fill="#ffffff" stroke="#d1d5db" />
                    <circle cx="24" cy="13" r="7" fill="#eb001b" />
                    <circle cx="32" cy="13" r="7" fill="#f79e1b" fill-opacity="0.9" />
                  </svg>
                </span>
                <span class="logo-svg" title="American Express">
                  <svg viewBox="0 0 56 26" aria-hidden="true">
                    <rect x="1" y="1" width="54" height="24" rx="7" fill="#0f7de8" />
                    <text x="28" y="14.5" fill="#ffffff" font-size="6.5" font-weight="800" text-anchor="middle">AMERICAN</text>
                    <text x="28" y="20.5" fill="#ffffff" font-size="6.5" font-weight="800" text-anchor="middle">EXPRESS</text>
                  </svg>
                </span>
                <span class="logo-svg" title="Diners Club">
                  <svg viewBox="0 0 56 26" aria-hidden="true">
                    <rect x="1" y="1" width="54" height="24" rx="7" fill="#ffffff" stroke="#d1d5db" />
                    <circle cx="28" cy="13" r="7.2" fill="#0069aa" />
                    <rect x="26" y="8.4" width="4" height="9.2" rx="2" fill="#ffffff" />
                  </svg>
                </span>
              </span>
            </button>
          </div>

          <p v-if="errorMessage" class="checkout-error" style="margin-top:1rem">{{ errorMessage }}</p>
        </section>

        <section class="checkout-side">
          <aside class="checkout-sidebar">
            <div class="sidebar-event-card">
              <div class="sidebar-event-info">
                <div class="sidebar-event-thumb">
                  <img :src="event?.banner_sm_url || event?.banner_url || '/event-placeholder.svg'" :alt="event?.title || 'Evento'" />
                </div>
                <div>
                  <h3 class="sidebar-event-title">{{ event?.title || 'Evento Sonia Morales' }}</h3>
                  <div class="sidebar-event-date">
                    <span class="sidebar-meta-item">{{ formatDate(event?.start_at || null) }}</span>
                    <span class="sidebar-meta-item">{{ formatTime(event?.start_at || null) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-for="(ticket, index) in ticketLabels" :key="index" class="sidebar-ticket-row">
              <div class="sidebar-ticket-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <p class="sidebar-ticket-label">{{ ticket.label }}</p>
                <p class="sidebar-ticket-price">{{ ticket.currency }}{{ formatCompactMoney(ticket.price) }} (incluye IGV)</p>
                <p v-if="ticket.processingFeeAmount > 0" class="sidebar-ticket-processing">
                  + {{ ticket.processingFeeLabel }} ({{ ticket.processingFeeRateLabel }}): {{ ticket.currency }}{{ formatCompactMoney(ticket.processingFeeAmount) }}
                </p>
              </div>
            </div>

            <div class="summary">
              <h4 class="summary-title">Resumen</h4>
              <div class="summary-row">
                <span>Monto del concierto (incluye IGV)</span>
                <span>S/{{ formatCompactMoney(concertAmount) }}</span>
              </div>
              <div class="summary-row">
                <span>{{ DEFAULT_PROCESSING_FEE_LABEL }} ({{ DEFAULT_PROCESSING_FEE_RATE_LABEL }})</span>
                <span>S/{{ formatCompactMoney(processingFeeAmount) }}</span>
              </div>
              <div class="summary-total">
                <span class="total-label">Total a pagar (incluye IGV)</span>
                <span class="total-amount">S/{{ formatCompactMoney(total) }}</span>
              </div>
            </div>

            <div class="trust-badges">
              <div class="badge-item">
                <svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p class="badge-text">Compra con confianza. Tus datos están seguros con nosotros. Seguridad garantizada en cada transacción.</p>
              </div>
              <div class="badge-item">
                <svg width="20" height="20" fill="none" stroke="#10b981" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="badge-text">Los eventos son responsabilidad exclusiva de sus organizadores.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>

    <footer class="checkout-footer">
      <div class="checkout-footer-inner">
        <div class="footer-info">
          <span class="footer-count">{{ totalTickets }} {{ totalTickets === 1 ? 'elemento' : 'elementos' }}</span>
          <span class="footer-total">S/{{ formatCompactMoney(total) }}</span>
        </div>

        <button class="btn-next" type="button" :disabled="paymentDisabled" @click="startPayment">
          {{ loading ? 'Procesando...' : 'Pagar' }}
        </button>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
declare global {
  interface Window {
    VisanetCheckout: {
      configure: (options: Record<string, unknown>) => void;
      open: () => void;
    };
  }
}
</script>
