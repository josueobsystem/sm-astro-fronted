<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatDate, formatMoney, formatTime } from '@/lib/api';
import { truncateWords } from '@/lib/text';
import type { CheckoutReservation, PublicEvent, ReservationItem } from '@/types/api';

const props = defineProps<{
  siteUrl: string;
  reservation: CheckoutReservation;
  event: PublicEvent | null;
  initialContact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    personId?: string | null;
  };
  niubizCheckoutUrl: string;
}>();

const NIUBIZ_MERCHANT_LOGO_PATH = '/niubiz-merchant-logo.png';
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
const selectedPaymentMethod = ref('');
const termsAccepted = ref(false);
const promotionsAccepted = ref(false);
const checkoutStep = ref<'payment' | 'summary'>('payment');
const contactDetailsOpen = ref(false);
const paymentMethodOpen = ref(false);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const secondsLeft = ref(secondsUntilExpiration());
let timer: ReturnType<typeof setInterval> | null = null;

const checkoutPersonId = computed(() => String(props.initialContact?.personId || '').trim());

const totalTickets = computed(() => props.reservation.items.reduce((sum, item) => {
  return sum + Number(item.quantity || 0);
}, 0));

function resolveUnitProcessingFee(item: ReservationItem, unitPrice: number): number {
  const explicitFee = Number(item.processing_fee_amount || 0);
  if (explicitFee > 0) {
    return roundMoney(explicitFee);
  }

  const unitTotal = Number(item.total_price || 0);
  if (unitTotal > unitPrice) {
    return roundMoney(unitTotal - unitPrice);
  }

  if (unitPrice <= 0) {
    return 0;
  }

  return roundMoney(unitPrice * DEFAULT_PROCESSING_FEE_TOTAL_RATE);
}

const ticketLabels = computed(() => props.reservation.items.map((item) => {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.price || 0);
  const unitFee = resolveUnitProcessingFee(item, unitPrice);
  const lineFee = roundMoney(unitFee * quantity);
  const lineSubtotal = roundMoney(unitPrice * quantity);
  const lineTotal = roundMoney(lineSubtotal + lineFee);

  return {
    quantity,
    label: `${quantity} ${quantity === 1 ? 'entrada' : 'entradas'} - ${item.name || 'Entrada'}`,
    subtotal: lineSubtotal,
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

  return sum + roundMoney(unitPrice * quantity);
}, 0));

const processingFeeAmount = computed(() => {
  const fromItems = props.reservation.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const unitFee = resolveUnitProcessingFee(item, unitPrice);

    return sum + roundMoney(unitFee * quantity);
  }, 0);

  return roundMoney(fromItems);
});

const total = computed(() => roundMoney(concertAmount.value + processingFeeAmount.value));
const eventDisplayTitle = computed(() => truncateWords(props.event?.title || 'Evento Sonia Morales', 20));
const timerDisplay = computed(() => {
  const minutes = Math.floor(secondsLeft.value / 60);
  const seconds = secondsLeft.value % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});
const timerUrgent = computed(() => secondsLeft.value <= 60);
const paymentDisabled = computed(() => {
  if (loading.value) return true;

  return checkoutStep.value === 'payment'
    ? !selectedPaymentMethod.value
    : !termsAccepted.value;
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

function goBack() {
  errorMessage.value = null;

  if (checkoutStep.value === 'summary') {
    checkoutStep.value = 'payment';
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  closeCheckout();
}

function fillContactFromSession() {
  const initialName = String(props.initialContact?.name || '').trim();
  const initialEmail = String(props.initialContact?.email || '').trim();
  const initialPhone = String(props.initialContact?.phone || '').trim();

  if (!name.value && initialName) {
    name.value = initialName;
  }

  if (!email.value && initialEmail) {
    email.value = initialEmail;
  }

  if (!phone.value && initialPhone) {
    phone.value = initialPhone;
  }
}

async function ensureAuthenticatedSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null) as { authenticated?: boolean } | null;

    return Boolean(payload?.authenticated);
  } catch {
    return false;
  }
}

function buildFrontendUrl(path: string): string {
  return new URL(path, props.siteUrl).toString();
}

function continueToSummary() {
  errorMessage.value = null;

  if (!selectedPaymentMethod.value) {
    errorMessage.value = 'Selecciona un método de pago para continuar.';
    return;
  }

  if (!name.value || !email.value) {
    contactDetailsOpen.value = true;
    errorMessage.value = 'Completa tus datos de contacto para continuar.';
    return;
  }

  if (billingType.value === 'factura' && (!/^\d{11}$/.test(ruc.value) || !razonSocial.value || !direccion.value)) {
    errorMessage.value = 'Completa los datos de factura para continuar.';
    return;
  }

  checkoutStep.value = 'summary';
}

function togglePaymentMethod() {
  selectedPaymentMethod.value = 'card';
  paymentMethodOpen.value = !paymentMethodOpen.value;
}

async function startPayment() {
  errorMessage.value = null;

  if (!selectedPaymentMethod.value) {
    errorMessage.value = 'Selecciona un método de pago para continuar.';
    return;
  }

  if (!termsAccepted.value) {
    errorMessage.value = 'Acepta los términos y condiciones para continuar.';
    return;
  }

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
    const response = await fetch('/api/orders/checkout/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reservation_id: props.reservation.id,
        customer_email: email.value,
        customer_name: name.value,
        customer_phone: phone.value || null,
        person_id: checkoutPersonId.value || null,
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
    // Niubiz debe publicar el resultado en nuestro dominio. El endpoint del
    // frontend reenvía la autorización al backend y vuelve a la pantalla de
    // resultado, sin depender de los redirects del API.
    const actionUrl = new URL('/api/orders/checkout/confirm', props.siteUrl);
    actionUrl.searchParams.set('reservation_id', props.reservation.id);
    // Niubiz solo envía el token en el POST de retorno. El número de compra
    // debe viajar en la URL para que el backend encuentre y autorice el pago.
    actionUrl.searchParams.set('purchase_number', data.purchase_number);
    actionUrl.searchParams.set('purchaseNumber', data.purchase_number);
    actionUrl.searchParams.set('payment_method', selectedPaymentMethod.value);
    actionUrl.searchParams.set('billing_type', billingType.value);
    actionUrl.searchParams.set('frontend_success_url', frontendSuccessUrl);

    if (checkoutPersonId.value) {
      actionUrl.searchParams.set('person_id', checkoutPersonId.value);
    }

    window.VisanetCheckout.configure({
      sessiontoken: data.session_token,
      channel: 'web',
      merchantid: data.merchant_id,
      purchasenumber: data.purchase_number,
      amount: Number(data.amount),
      merchantlogo: buildFrontendUrl(NIUBIZ_MERCHANT_LOGO_PATH),
      merchantname: 'Sonia Morales',
      timeouturl: buildFrontendUrl('/checkout/timeout'),
      action: actionUrl.toString(),
    });
    window.VisanetCheckout.open();
    // Niubiz administra su propio modal. Al cerrarlo no devuelve un callback,
    // por lo que el checkout debe quedar disponible para que el usuario reintente.
    loading.value = false;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No pudimos iniciar el pago.';
    loading.value = false;
  }
}

onMounted(() => {
  fillContactFromSession();
  contactDetailsOpen.value = !name.value || !email.value;

  void ensureAuthenticatedSession().then((authenticated) => {
    if (authenticated) {
      return;
    }

    const redirect = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
  });

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
    <div class="checkout-brand-bar">
      <a href="/" aria-label="Volver al inicio de Sonia Morales">
        <img src="https://ob-sm-systema-tickets.us-southeast-1.linodeobjects.com/web%2FLOGO%203.png" alt="Sonia Morales" />
      </a>
    </div>

    <div class="checkout-progress-wrap">
      <div class="checkout-progress-shell">
        <div class="checkout-progress-bar">
          <div class="checkout-progress-fill"></div>
        </div>
      </div>
    </div>

    <header class="checkout-header">
      <div class="checkout-header-inner">
        <div class="checkout-header-progress">
          <button class="checkout-back" type="button" :aria-label="checkoutStep === 'summary' ? 'Volver a datos de compra' : 'Volver a la selección de entradas'" @click="goBack">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <nav class="checkout-steps" aria-label="Progreso de compra">
            <ol>
              <li class="is-complete">
                <span class="checkout-step-marker">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m5 12 4 4L19 6" /></svg>
                </span>
                <span>Entradas</span>
              </li>
              <li :class="{ 'is-current': checkoutStep === 'payment', 'is-complete': checkoutStep === 'summary' }">
                <span class="checkout-step-marker">
                  <svg v-if="checkoutStep === 'summary'" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m5 12 4 4L19 6" /></svg>
                  <span v-else>2</span>
                </span>
                <span>Datos de compra</span>
              </li>
              <li :class="{ 'is-current': checkoutStep === 'summary' }">
                <span class="checkout-step-marker">3</span>
                <span>Confirmación</span>
              </li>
            </ol>
          </nav>
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
          <template v-if="checkoutStep === 'payment'">
          <div class="checkout-contact-section">
            <button class="checkout-contact-toggle" type="button" :aria-expanded="contactDetailsOpen" @click="contactDetailsOpen = !contactDetailsOpen">
              <span>
                <span class="checkout-section-label">Datos de contacto</span>
                <small v-if="name && email">{{ name }} · {{ email }}</small>
                <small v-else>Completa la información para recibir tus entradas.</small>
              </span>
              <svg :class="{ 'is-open': contactDetailsOpen }" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="m7 10 5 5 5-5z" />
              </svg>
            </button>
            <div v-show="contactDetailsOpen" class="checkout-contact-card checkout-contact-fields">
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
          </div>

          <div class="billing-section">
            <p class="checkout-section-label">Facturación</p>

            <div class="billing-wrap">
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
          </div>

          <div class="payment-selector">
            <p class="checkout-section-label">Selecciona tu medio de pago</p>

            <div class="niubiz-payment-method" :class="{ 'is-open': paymentMethodOpen }">
              <button class="niubiz-payment-method__trigger" type="button" :aria-expanded="paymentMethodOpen" @click="togglePaymentMethod">
                <span class="niubiz-payment-method__brands">
                  <img src="/niubiz-payment-methods.png" alt="Visa, Mastercard, American Express, Diners Club y Yape" />
                </span>
                <span class="niubiz-yape-wordmark">NIUBIZ-YAPE</span>
                <span class="niubiz-payment-method__selected" aria-hidden="true">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m5 12 4 4L19 6" />
                  </svg>
                </span>
              </button>

              <div v-if="paymentMethodOpen" class="niubiz-payment-method__content">
                <span class="niubiz-payment-method__title">Tarjeta de crédito / débito / Yape</span>
                <span class="niubiz-payment-method__description">
                  Paga de forma segura con tarjetas de crédito, débito o yape. Revisa el detalle de la compra y el monto a pagar antes de continuar, una vez procesado el pago no existen cambios ni devoluciones.
                </span>
                <img class="niubiz-payment-method__operator" src="/niubiz-operated-by.png" alt="Operado por Niubiz" />
              </div>
            </div>
          </div>
          </template>

          <section v-if="checkoutStep === 'summary'" class="checkout-summary-section" aria-labelledby="checkout-purchase-summary-title">
            <h2 id="checkout-purchase-summary-title" class="checkout-section-label">Resumen de compra</h2>

            <div class="checkout-purchase-summary">
              <div class="checkout-purchase-summary__meta">
                <span class="checkout-purchase-summary__items">{{ totalTickets }} {{ totalTickets === 1 ? 'entrada' : 'entradas' }}</span>
              </div>
              <div class="checkout-summary-table-wrap">
                <table class="checkout-summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Cant.</th>
                      <th scope="col">Entrada</th>
                      <th scope="col">Precio</th>
                      <th scope="col">Cargo</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(ticket, index) in ticketLabels" :key="`${ticket.label}-${index}`">
                      <td>{{ ticket.quantity }}</td>
                      <td>{{ ticket.label }}</td>
                      <td>{{ ticket.currency }}{{ formatCompactMoney(ticket.subtotal) }}</td>
                      <td>{{ ticket.currency }}{{ formatCompactMoney(ticket.processingFeeAmount) }}</td>
                      <td>{{ ticket.currency }}{{ formatCompactMoney(ticket.price) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colspan="4" scope="row">Total a pagar</th>
                      <td>S/{{ formatCompactMoney(total) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <fieldset class="checkout-required-consents">
              <legend>Necesario para continuar</legend>
              <label>
                <input v-model="termsAccepted" type="checkbox" />
                <span>Declaro que he leído y acepto los <a href="/terms">Términos y Condiciones</a> y la <a href="/policy">Política de Privacidad</a>.</span>
              </label>
              <label>
                <input v-model="promotionsAccepted" type="checkbox" />
                <span>Autorizo recibir información sobre eventos, promociones y encuestas. <em>Opcional</em></span>
              </label>
            </fieldset>
          </section>

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
                  <h3 class="sidebar-event-title">{{ eventDisplayTitle }}</h3>
                  <div class="sidebar-event-date">
                    <span class="sidebar-meta-item">{{ formatDate(event?.start_at || null) }}</span>
                    <span class="sidebar-meta-item">{{ formatTime(event?.start_at || null) }}</span>
                  </div>
                </div>
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

          <div class="checkout-side-payment">
            <div class="footer-info">
              <span class="footer-count">{{ totalTickets }} {{ totalTickets === 1 ? 'elemento' : 'elementos' }}</span>
              <span class="footer-total">S/{{ formatCompactMoney(total) }}</span>
            </div>

            <button class="btn-next" type="button" :disabled="paymentDisabled" @click="checkoutStep === 'summary' ? startPayment() : continueToSummary()">
              {{ loading ? 'Procesando...' : (checkoutStep === 'summary' ? 'Pagar' : 'Continuar') }}
            </button>
          </div>
        </section>
      </div>
    </main>
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
