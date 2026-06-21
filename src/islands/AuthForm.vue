<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

type LocationOption = {
  id?: string | number | null;
  code?: string | null;
  district_id?: string | number | null;
  label?: string | null;
  name?: string | null;
};

const props = withDefaults(defineProps<{
  mode: 'login' | 'register';
  apiBaseUrl?: string;
  redirectTo?: string;
  successMode?: 'redirect' | 'emit';
  inlineMode?: boolean;
}>(), {
  apiBaseUrl: '',
  redirectTo: '/',
  successMode: 'redirect',
  inlineMode: false,
});

const emit = defineEmits<{
  (event: 'success'): void;
}>();

const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const firstName = ref('');
const lastName = ref('');
const country = ref('PE');
const city = ref('');
const cityInput = ref('');
const cities = ref<LocationOption[]>([]);
const citiesLoading = ref(false);
const cityOpen = ref(false);
const activeCityIndex = ref(-1);
const documentNumber = ref('');
const gender = ref('');
const phone = ref('');
const terms = ref(false);
const remember = ref(false);
const showPassword = ref(false);
const showPasswordConfirmation = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const isRegister = computed(() => props.mode === 'register');
const redirectQuery = computed(() => `redirect=${encodeURIComponent(props.redirectTo || '/')}`);
const backendApiBaseUrl = computed(() => props.apiBaseUrl || import.meta.env.PUBLIC_API_BASE_URL || '');
const googleUrl = computed(() => {
  const backendUrl = backendApiBaseUrl.value.trim();

  if (!backendUrl) {
    return `/api/auth/google?${redirectQuery.value}`;
  }

  try {
    const url = new URL('/api/auth/google', backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`);
    url.searchParams.set('redirect', props.redirectTo || '/');

    return url.toString();
  } catch {
    return `/api/auth/google?${redirectQuery.value}`;
  }
});
const loginHref = computed(() => `/login?${redirectQuery.value}`);
const registerHref = computed(() => `/register?${redirectQuery.value}`);
const registerCityEnabled = computed(() => isRegister.value && country.value === 'PE');

const normalize = (value = '') => value
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .trim();

const mappedCities = computed(() => cities.value
  .map((option) => {
    const districtId = option.district_id ?? null;
    const id = String(districtId ?? option.id ?? option.code ?? '');
    const label = String(option.label ?? option.name ?? '').trim();
    const normalizedLabel = normalize(label);
    const normalizedSegments = normalizedLabel
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    return {
      id,
      code: String(option.code ?? ''),
      districtId: districtId === null ? null : String(districtId),
      label: label.toUpperCase(),
      normalizedLabel,
      normalizedSegments,
      raw: option,
    };
  })
  .filter((option) => option.id && option.label));

const selectedCityOption = computed(() => {
  const selectedId = String(city.value || '');
  if (!selectedId) return null;

  return mappedCities.value.find((option) => (
    option.id === selectedId ||
    option.code === selectedId ||
    option.districtId === selectedId
  )) || null;
});

const filteredCities = computed(() => {
  const query = normalize(cityInput.value);
  if (!query) {
    return mappedCities.value.slice(0, 80);
  }

  return mappedCities.value
    .map((option) => {
      let rank = 99;

      if (option.normalizedLabel === query) rank = 0;
      else if (option.normalizedSegments.includes(query)) rank = 1;
      else if (option.normalizedLabel.startsWith(query)) rank = 2;
      else if (option.normalizedSegments.some((segment) => segment.startsWith(query))) rank = 3;
      else if (option.normalizedLabel.includes(query)) rank = 4;

      return { option, rank };
    })
    .filter((entry) => entry.rank < 99)
    .sort((a, b) => (a.rank - b.rank) || a.option.label.localeCompare(b.option.label))
    .map((entry) => entry.option)
    .slice(0, 80);
});

const authErrorMap: Record<string, string> = {
  'auth.failed': 'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.',
  'auth.password': 'La contraseña ingresada es incorrecta.',
  'auth.throttle': 'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos segundos.',
};

function normalizeError(raw: unknown): string {
  const message = String(raw ?? '').trim();

  if (!message) return '';
  if (authErrorMap[message]) return authErrorMap[message];
  if (message.includes('auth.failed') || message.includes('These credentials do not match our records.')) {
    return authErrorMap['auth.failed'];
  }

  return message;
}

async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json();

  return payload.token || '';
}

async function loadCities() {
  if (cities.value.length > 0 || citiesLoading.value || !registerCityEnabled.value) {
    return;
  }

  citiesLoading.value = true;

  try {
    const response = await fetch('/api/locations/cities', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const payload = await response.json();
    cities.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    cities.value = [];
  } finally {
    citiesLoading.value = false;
  }
}

function openCityDropdown() {
  if (!registerCityEnabled.value) return;
  cityOpen.value = true;
  void loadCities();
}

function closeCityDropdown() {
  cityOpen.value = false;
  activeCityIndex.value = -1;
}

function selectCity(option: typeof mappedCities.value[number]) {
  city.value = option.id;
  cityInput.value = option.label;
  closeCityDropdown();
}

function clearCity() {
  city.value = '';
  cityInput.value = '';
  activeCityIndex.value = -1;
  openCityDropdown();
}

function handleCityInput(event: Event) {
  cityInput.value = ((event.target as HTMLInputElement).value || '').toUpperCase();
  city.value = '';
  openCityDropdown();
}

function handleCityKeydown(event: KeyboardEvent) {
  if (!cityOpen.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    openCityDropdown();
  }

  if (!cityOpen.value) return;

  const options = filteredCities.value;
  if (options.length === 0) {
    if (event.key === 'Escape') closeCityDropdown();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeCityIndex.value = activeCityIndex.value < options.length - 1 ? activeCityIndex.value + 1 : 0;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeCityIndex.value = activeCityIndex.value > 0 ? activeCityIndex.value - 1 : options.length - 1;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    selectCity(options[activeCityIndex.value] || options[0]);
  } else if (event.key === 'Escape') {
    closeCityDropdown();
  }
}

function handleCityBlur() {
  window.setTimeout(() => {
    const query = normalize(cityInput.value);
    if (!city.value && query) {
      const options = filteredCities.value;
      const exactLabel = options.find((option) => option.normalizedLabel === query);
      const exactSegmentMatches = options.filter((option) => option.normalizedSegments.includes(query));
      const autoPick = exactLabel
        || (exactSegmentMatches.length === 1 ? exactSegmentMatches[0] : null)
        || (options.length === 1 ? options[0] : null);

      if (autoPick) {
        selectCity(autoPick);
        return;
      }
    }

    closeCityDropdown();
    cityInput.value = selectedCityOption.value?.label || '';
  }, 120);
}

async function submit() {
  errorMessage.value = '';

  if (isRegister.value && !terms.value) {
    errorMessage.value = 'Acepta los términos y condiciones para continuar.';
    return;
  }

  loading.value = true;

  try {
    const token = await csrfToken();
    const endpoint = isRegister.value ? '/register' : '/login';
    const body = isRegister.value
      ? {
          first_name: firstName.value,
          last_name: lastName.value,
          email: email.value,
          password: password.value,
          password_confirmation: passwordConfirmation.value,
          country: country.value,
          city: city.value,
          document_number: documentNumber.value,
          gender: gender.value,
          phone: phone.value,
          terms: terms.value,
        }
      : {
          email: email.value,
          password: password.value,
          remember: remember.value ? 'on' : '',
        };

    const response = await fetch(`/api/auth${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok || payload.status === 'error') {
      const validations = payload.validations || {};
      const firstValidation = Object.values(validations).flat()[0];
      throw new Error(normalizeError(firstValidation || payload.message || 'No pudimos completar la solicitud.'));
    }

    if (props.successMode === 'emit') {
      emit('success');
      return;
    }

    window.location.href = props.redirectTo || '/';
  } catch (error) {
    errorMessage.value = normalizeError(error instanceof Error ? error.message : 'No pudimos completar la solicitud.');
  } finally {
    loading.value = false;
  }
}

watch(country, (value) => {
  if (value !== 'PE') {
    clearCity();
  } else {
    void loadCities();
  }
});

onMounted(() => {
  if (isRegister.value) {
    void loadCities();
  }
});
</script>

<template>
  <div class="auth-card" :class="{ 'auth-card--scroll': isRegister, 'auth-card--inline': props.inlineMode }">
    <div class="auth-logo" :class="{ 'auth-logo--register': isRegister }">
      <img
        src="https://ob-sm-systema-tickets.us-southeast-1.linodeobjects.com/web%2FLOGO%203.png"
        alt="Sonia Morales"
      />
    </div>

    <template v-if="!isRegister">
      <h1 class="auth-title">¡Bienvenido a Sonia Morales!</h1>
      <div class="auth-switch">
        ¿No tienes cuenta?
        <a :href="registerHref">Regístrate aquí</a>
      </div>
    </template>

    <template v-else>
      <div class="auth-switch">
        ¿Ya tienes cuenta?
        <a :href="loginHref">Inicia Sesión</a>
      </div>
      <h1 class="auth-title">Regístrate</h1>
      <p class="auth-subtitle" style="margin:0 0 1rem">Por favor, ingresa tus datos</p>
    </template>

    <a :href="googleUrl" class="google-button">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.509h3.232c1.891-1.741 2.982-4.305 2.982-7.35z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.041.955-3.386.955-2.605 0-4.81-1.759-5.596-4.123H3.064v2.591A9.997 9.997 0 0 0 12 22z" />
        <path fill="#FBBC05" d="M6.404 13.9A6.01 6.01 0 0 1 6.091 12c0-.659.114-1.3.313-1.9V7.509h-3.34A9.997 9.997 0 0 0 2 12c0 1.614.386 3.141 1.064 4.491L6.404 13.9z" />
        <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.991 14.695 2 12 2a9.997 9.997 0 0 0-8.936 5.509l3.34 2.591C7.19 7.736 9.395 5.977 12 5.977z" />
      </svg>
      Continuar con Google
    </a>

    <div class="auth-divider">{{ isRegister ? 'o con correo' : 'o ingresa con tu correo' }}</div>

    <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

    <form class="auth-form" @submit.prevent="submit">
      <input v-model="email" class="auth-input" type="email" placeholder="Correo electrónico" required autocomplete="username" />

      <div class="auth-password">
        <input
          v-model="password"
          class="auth-input"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Contraseña"
          required
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
        />
        <button class="auth-eye" type="button" @click="showPassword = !showPassword" aria-label="Mostrar contraseña">
          <svg v-if="!showPassword" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <svg v-else width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.416-3.413M9.88 9.88A8.973 8.973 0 003 12c1.274 4.057 5.064 7 9 7a8.96 8.96 0 004.121-.997M14.12 14.12A8.969 8.969 0 0021 12c-1.274-4.057-5.064-7-9-7a8.96 8.96 0 00-4.121.997" />
          </svg>
        </button>
      </div>

      <template v-if="isRegister">
        <p class="auth-note" style="margin:-.5rem 0 0;color:var(--color-primary-300)">
          Utiliza una contraseña fuerte y única para esta cuenta
        </p>

        <div class="auth-password">
          <input
            v-model="passwordConfirmation"
            class="auth-input"
            :type="showPasswordConfirmation ? 'text' : 'password'"
            placeholder="Confirmar contraseña"
            required
            autocomplete="new-password"
          />
          <button class="auth-eye" type="button" @click="showPasswordConfirmation = !showPasswordConfirmation" aria-label="Mostrar confirmación">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>

        <div class="auth-grid">
          <input v-model="firstName" class="auth-input" placeholder="Nombres" required autocomplete="given-name" />
          <input v-model="lastName" class="auth-input" placeholder="Apellidos" required autocomplete="family-name" />
        </div>

        <select v-model="country" class="auth-select">
          <option value="">País</option>
          <option value="PE">Perú</option>
        </select>

        <div class="auth-autocomplete">
          <input
            :value="cityInput"
            class="auth-input auth-input--uppercase"
            placeholder="BUSCAR UBICACION (LIMA / LIMA / RIMAC)"
            autocomplete="off"
            :disabled="!registerCityEnabled"
            @focus="openCityDropdown"
            @input="handleCityInput"
            @keydown="handleCityKeydown"
            @blur="handleCityBlur"
          />
          <button
            v-if="cityInput || city"
            type="button"
            class="auth-autocomplete-clear"
            aria-label="Limpiar ubicacion"
            @mousedown.prevent
            @click="clearCity"
          >
            X
          </button>
          <div v-if="cityOpen" class="auth-autocomplete-menu">
            <div v-if="citiesLoading" class="auth-autocomplete-empty">Cargando...</div>
            <template v-else>
              <button
                v-for="(option, index) in filteredCities"
                :key="`${option.id}-${index}`"
                type="button"
                class="auth-autocomplete-option"
                :class="{ 'is-active': index === activeCityIndex }"
                @mousedown.prevent="selectCity(option)"
              >
                {{ option.label }}
              </button>
              <div v-if="filteredCities.length === 0" class="auth-autocomplete-empty">SIN COINCIDENCIAS</div>
            </template>
          </div>
        </div>

        <div class="auth-grid">
          <input v-model="documentNumber" class="auth-input" placeholder="DNI" />
          <select v-model="gender" class="auth-select">
            <option value="">Género</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="O">Otro</option>
          </select>
        </div>

        <input v-model="phone" class="auth-input" type="tel" placeholder="Teléfono" autocomplete="tel" />

        <div class="auth-note">
          Al continuar, acepto los <a class="auth-link" href="/terms">Términos y Condiciones</a>
          y la <a class="auth-link" href="/policy">Política de Privacidad</a>*
        </div>

        <label class="auth-consent">
          <input v-model="terms" type="checkbox" />
          <span>Acepto haber leído correctamente los <span class="auth-link">Términos y Condiciones</span></span>
        </label>
      </template>

      <template v-else>
        <label class="auth-consent" style="justify-content:space-between">
          <span><input v-model="remember" type="checkbox" /> Recordarme</span>
          <a class="auth-link" href="/forgot-password">¿Olvidaste tu contraseña?</a>
        </label>
      </template>

      <button class="auth-submit" type="submit" :disabled="loading">
        {{ loading ? 'Procesando...' : (isRegister ? 'Registrarme' : 'Ingresar') }}
      </button>
    </form>
  </div>
</template>
