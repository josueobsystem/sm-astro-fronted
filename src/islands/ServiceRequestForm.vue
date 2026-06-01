<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

type Option = {
  id: number | string;
  name: string;
};

type ApiPayload<T> = {
  status?: 'success' | 'error';
  message?: string | null;
  data?: T;
  validations?: Record<string, unknown>;
  errors?: Record<string, unknown>;
};

const eventTypes = [
  { value: 'Boda', label: 'Boda' },
  { value: 'Corporativo', label: 'Corporativo' },
  { value: 'Social', label: 'Social' },
  { value: 'Cumpleanos', label: 'Cumpleanos' },
  { value: 'Concierto', label: 'Concierto' },
  { value: 'Otro', label: 'Otro' },
];

const departments = ref<Option[]>([]);
const provinces = ref<Option[]>([]);
const districts = ref<Option[]>([]);
const loadingDepartments = ref(false);
const loadingProvinces = ref(false);
const loadingDistricts = ref(false);

const submitting = ref(false);
const successMessage = ref('');
const errorMessage = ref('');
const fieldErrors = ref<Record<string, string>>({});

const authChecked = ref(false);
const isAuthenticated = ref(false);
const csrfToken = ref('');
const redirectTarget = ref('/service-request#contacto');

const form = reactive({
  event_type: '',
  description: '',
  reason: '',
  venue_address: '',
  event_date: '',
  start_time: '',
  end_time: '',
  tos_accepted: false,
  department_id: '',
  province_id: '',
  district_id: '',
});

const loginHref = computed(() => `/login?redirect=${encodeURIComponent(redirectTarget.value)}`);
const registerHref = computed(() => `/register?redirect=${encodeURIComponent(redirectTarget.value)}`);

function resetMessages() {
  successMessage.value = '';
  errorMessage.value = '';
  fieldErrors.value = {};
}

function firstValidationMessage(validations: unknown): string {
  if (!validations || typeof validations !== 'object') {
    return '';
  }

  for (const value of Object.values(validations as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = String(value[0] || '').trim();
      if (first) return first;
    }

    const single = String(value || '').trim();
    if (single) return single;
  }

  return '';
}

function mapFieldErrors(validations: unknown) {
  if (!validations || typeof validations !== 'object') {
    return;
  }

  const mapped: Record<string, string> = {};

  Object.entries(validations as Record<string, unknown>).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      mapped[key] = String(value[0] || '').trim();
      return;
    }

    mapped[key] = String(value || '').trim();
  });

  fieldErrors.value = mapped;
}

function clearForm() {
  form.event_type = '';
  form.description = '';
  form.reason = '';
  form.venue_address = '';
  form.event_date = '';
  form.start_time = '';
  form.end_time = '';
  form.tos_accepted = false;
  form.department_id = '';
  form.province_id = '';
  form.district_id = '';
  provinces.value = [];
  districts.value = [];
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken.value) {
    return csrfToken.value;
  }

  const response = await fetch('/api/auth/csrf-token', {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({ token: '' })) as { token?: string };
  csrfToken.value = String(payload.token || '');

  return csrfToken.value;
}

async function checkAuth(): Promise<boolean> {
  if (authChecked.value) {
    return isAuthenticated.value;
  }

  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const payload = await response.json().catch(() => null) as {
      authenticated?: boolean;
      csrf_token?: string;
    } | null;

    isAuthenticated.value = Boolean(payload?.authenticated);
    if (payload?.csrf_token) {
      csrfToken.value = String(payload.csrf_token);
    }
  } catch {
    isAuthenticated.value = false;
  } finally {
    authChecked.value = true;
  }

  return isAuthenticated.value;
}

async function loadDepartments() {
  if (loadingDepartments.value || departments.value.length > 0) {
    return;
  }

  loadingDepartments.value = true;

  try {
    const response = await fetch('/api/locations/departments', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => null) as ApiPayload<Option[] | null> | null;
    departments.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    departments.value = [];
  } finally {
    loadingDepartments.value = false;
  }
}

async function loadProvinces(departmentId: string) {
  if (!departmentId) {
    provinces.value = [];
    return;
  }

  loadingProvinces.value = true;

  try {
    const response = await fetch(`/api/locations/provinces/${encodeURIComponent(departmentId)}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => null) as ApiPayload<Option[] | null> | null;
    provinces.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    provinces.value = [];
  } finally {
    loadingProvinces.value = false;
  }
}

async function loadDistricts(provinceId: string) {
  if (!provinceId) {
    districts.value = [];
    return;
  }

  loadingDistricts.value = true;

  try {
    const response = await fetch(`/api/locations/districts/${encodeURIComponent(provinceId)}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = await response.json().catch(() => null) as ApiPayload<Option[] | null> | null;
    districts.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    districts.value = [];
  } finally {
    loadingDistricts.value = false;
  }
}

function validate(): boolean {
  const errors: Record<string, string> = {};

  if (!form.event_type) errors.event_type = 'Selecciona el tipo de evento.';
  if (!form.description.trim()) errors.description = 'Describe brevemente tu evento.';
  if (!form.venue_address.trim()) errors.venue_address = 'La direccion del evento es obligatoria.';
  if (!form.department_id) errors.department_id = 'Selecciona el departamento.';
  if (!form.province_id) errors.province_id = 'Selecciona la provincia.';
  if (!form.district_id) errors.district_id = 'Selecciona el distrito.';

  if (!form.event_date) {
    errors.event_date = 'La fecha del evento es obligatoria.';
  } else {
    const selectedDate = new Date(`${form.event_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      errors.event_date = 'La fecha del evento debe ser posterior a hoy.';
    }
  }

  if (!form.start_time) errors.start_time = 'Ingresa la hora de inicio.';
  if (!form.end_time) {
    errors.end_time = 'Ingresa la hora de fin.';
  } else if (form.start_time && form.end_time <= form.start_time) {
    errors.end_time = 'La hora de fin debe ser posterior a la hora de inicio.';
  }

  if (!form.tos_accepted) errors.tos_accepted = 'Debes aceptar los terminos para enviar la solicitud.';

  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function submit() {
  resetMessages();

  if (!validate()) {
    errorMessage.value = 'Revisa los campos marcados e intenta nuevamente.';
    return;
  }

  const authenticated = await checkAuth();
  if (!authenticated) {
    errorMessage.value = 'Inicia sesion o registrate para enviar tu solicitud.';
    return;
  }

  submitting.value = true;

  try {
    const token = await getCsrfToken();

    const response = await fetch('/api/crm/service-requests', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        district_id: Number(form.district_id),
        event_type: form.event_type,
        description: form.description.trim(),
        reason: form.reason.trim() || null,
        venue_address: form.venue_address.trim(),
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        tos_accepted: form.tos_accepted,
      }),
    });

    const payload = await response.json().catch(() => null) as ApiPayload<unknown> | null;

    if (!response.ok || payload?.status === 'error') {
      const validations = payload?.validations || payload?.errors;
      mapFieldErrors(validations);
      const first = firstValidationMessage(validations);
      throw new Error(first || payload?.message || 'No se pudo enviar la solicitud.');
    }

    successMessage.value = payload?.message || 'Tu solicitud fue enviada correctamente.';
    clearForm();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.';
  } finally {
    submitting.value = false;
  }
}

watch(() => form.department_id, (value) => {
  form.province_id = '';
  form.district_id = '';
  provinces.value = [];
  districts.value = [];

  if (value) {
    void loadProvinces(value);
  }
});

watch(() => form.province_id, (value) => {
  form.district_id = '';
  districts.value = [];

  if (value) {
    void loadDistricts(value);
  }
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    redirectTarget.value = `${window.location.pathname}${window.location.search}#contacto`;
  }

  void checkAuth();
  void loadDepartments();
});
</script>

<template>
  <div class="service-request-layout" id="contacto">
    <article class="service-request-summary">
      <p class="eyebrow">Eventos privados y corporativos</p>
      <h3>Solicitud para eventos de Sonia Morales</h3>
      <p>
        Comparte los datos clave de tu evento y nuestro equipo comercial te contactara para cotizacion, disponibilidad y propuesta.
      </p>
      <ul>
        <li>Respuesta del equipo en horario de oficina.</li>
        <li>Seguimiento desde tu perfil en "Mis Solicitudes".</li>
        <li>Atencion para bodas, fiestas privadas y eventos corporativos.</li>
      </ul>
    </article>

    <article class="service-request-card">
      <h3>Completa tu solicitud</h3>
      <p class="service-request-subtitle">
        Todos los campos marcados con * son obligatorios.
      </p>

      <p v-if="errorMessage" class="service-request-alert service-request-alert--error">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="service-request-alert service-request-alert--success">
        {{ successMessage }}
      </p>

      <p v-if="!isAuthenticated" class="service-request-auth-hint">
        Para enviar la solicitud debes tener una cuenta.
        <a :href="loginHref">Iniciar sesion</a>
        <span>o</span>
        <a :href="registerHref">registrarme</a>
      </p>

      <form class="service-request-form" @submit.prevent="submit">
        <div class="service-request-grid service-request-grid--2">
          <label class="service-request-field">
            <span>Tipo de evento *</span>
            <select v-model="form.event_type" class="service-request-input">
              <option value="">Selecciona un tipo</option>
              <option v-for="option in eventTypes" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <small v-if="fieldErrors.event_type">{{ fieldErrors.event_type }}</small>
          </label>

          <label class="service-request-field">
            <span>Motivo o referencia</span>
            <input
              v-model="form.reason"
              class="service-request-input"
              type="text"
              placeholder="Ejemplo: aniversario institucional"
              maxlength="255"
            />
          </label>
        </div>

        <label class="service-request-field">
          <span>Descripcion del evento *</span>
          <textarea
            v-model="form.description"
            class="service-request-input service-request-input--textarea"
            rows="4"
            placeholder="Cuentanos aforo estimado, formato y necesidades principales."
          ></textarea>
          <small v-if="fieldErrors.description">{{ fieldErrors.description }}</small>
        </label>

        <label class="service-request-field">
          <span>Direccion del venue *</span>
          <input
            v-model="form.venue_address"
            class="service-request-input"
            type="text"
            placeholder="Av / calle, referencia y nombre del local"
            maxlength="255"
          />
          <small v-if="fieldErrors.venue_address">{{ fieldErrors.venue_address }}</small>
        </label>

        <div class="service-request-grid service-request-grid--3">
          <label class="service-request-field">
            <span>Departamento *</span>
            <select v-model="form.department_id" class="service-request-input" :disabled="loadingDepartments">
              <option value="">{{ loadingDepartments ? 'Cargando...' : 'Selecciona' }}</option>
              <option v-for="department in departments" :key="department.id" :value="String(department.id)">
                {{ department.name }}
              </option>
            </select>
            <small v-if="fieldErrors.department_id">{{ fieldErrors.department_id }}</small>
          </label>

          <label class="service-request-field">
            <span>Provincia *</span>
            <select v-model="form.province_id" class="service-request-input" :disabled="!form.department_id || loadingProvinces">
              <option value="">{{ loadingProvinces ? 'Cargando...' : 'Selecciona' }}</option>
              <option v-for="province in provinces" :key="province.id" :value="String(province.id)">
                {{ province.name }}
              </option>
            </select>
            <small v-if="fieldErrors.province_id">{{ fieldErrors.province_id }}</small>
          </label>

          <label class="service-request-field">
            <span>Distrito *</span>
            <select v-model="form.district_id" class="service-request-input" :disabled="!form.province_id || loadingDistricts">
              <option value="">{{ loadingDistricts ? 'Cargando...' : 'Selecciona' }}</option>
              <option v-for="district in districts" :key="district.id" :value="String(district.id)">
                {{ district.name }}
              </option>
            </select>
            <small v-if="fieldErrors.district_id">{{ fieldErrors.district_id }}</small>
          </label>
        </div>

        <div class="service-request-grid service-request-grid--3">
          <label class="service-request-field">
            <span>Fecha del evento *</span>
            <input v-model="form.event_date" class="service-request-input" type="date" />
            <small v-if="fieldErrors.event_date">{{ fieldErrors.event_date }}</small>
          </label>

          <label class="service-request-field">
            <span>Hora de inicio *</span>
            <input v-model="form.start_time" class="service-request-input" type="time" />
            <small v-if="fieldErrors.start_time">{{ fieldErrors.start_time }}</small>
          </label>

          <label class="service-request-field">
            <span>Hora de fin *</span>
            <input v-model="form.end_time" class="service-request-input" type="time" />
            <small v-if="fieldErrors.end_time">{{ fieldErrors.end_time }}</small>
          </label>
        </div>

        <label class="service-request-check">
          <input v-model="form.tos_accepted" type="checkbox" />
          <span>Acepto los terminos y condiciones del servicio. *</span>
        </label>
        <small v-if="fieldErrors.tos_accepted" class="service-request-check-error">
          {{ fieldErrors.tos_accepted }}
        </small>

        <div class="service-request-actions">
          <button class="cta-button" type="submit" :disabled="submitting">
            {{ submitting ? 'Enviando solicitud...' : 'Enviar solicitud' }}
          </button>
          <a class="ghost-button" href="/user/profile?tab=service-requests">Ver mis solicitudes</a>
        </div>
      </form>
    </article>
  </div>
</template>
