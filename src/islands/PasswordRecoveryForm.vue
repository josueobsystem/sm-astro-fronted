<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  mode: 'forgot' | 'reset';
  token?: string | null;
  initialEmail?: string | null;
  loginHref?: string;
}>();

const isReset = computed(() => props.mode === 'reset');
const loginHref = computed(() => props.loginHref || '/login');

const email = ref((props.initialEmail || '').trim());
const password = ref('');
const passwordConfirmation = ref('');
const showPassword = ref(false);
const showPasswordConfirmation = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

function firstValidationMessage(validations: unknown): string {
  if (!validations || typeof validations !== 'object') {
    return '';
  }

  for (const value of Object.values(validations as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeError(raw: unknown): string {
  const message = String(raw || '').trim();
  if (!message) {
    return 'No pudimos completar la solicitud.';
  }

  if (
    message.includes('passwords.token')
    || message.includes('invalid password reset token')
    || message.includes('This password reset token is invalid.')
  ) {
    return 'El enlace de recuperación es inválido o expiró. Solicita uno nuevo.';
  }

  if (
    message.includes('passwords.user')
    || message.includes('We can\'t find a user')
    || message.includes('Unable to find a user')
  ) {
    return 'No encontramos una cuenta asociada a ese correo.';
  }

  return message;
}

async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({ token: '' })) as { token?: string };

  return payload.token || '';
}

async function submit() {
  errorMessage.value = '';
  successMessage.value = '';

  if (isReset.value && !props.token) {
    errorMessage.value = 'El enlace no contiene un token válido.';
    return;
  }

  loading.value = true;

  try {
    const token = await csrfToken();
    const endpoint = isReset.value ? '/api/auth/reset-password' : '/api/auth/forgot-password';
    const body = isReset.value
      ? {
          token: props.token,
          email: email.value,
          password: password.value,
          password_confirmation: passwordConfirmation.value,
        }
      : {
          email: email.value,
        };

    const response = await fetch(endpoint, {
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

    const payload = await response.json().catch(() => null) as
      | {
          status?: string;
          message?: string;
          validations?: Record<string, unknown>;
          errors?: Record<string, unknown>;
        }
      | null;

    if (!response.ok || payload?.status === 'error') {
      const firstValidation = firstValidationMessage(payload?.validations || payload?.errors);
      throw new Error(firstValidation || payload?.message || 'No pudimos completar la solicitud.');
    }

    if (isReset.value) {
      successMessage.value = 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.';
      password.value = '';
      passwordConfirmation.value = '';
      return;
    }

    successMessage.value = 'Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.';
  } catch (error) {
    errorMessage.value = normalizeError(error instanceof Error ? error.message : error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-card">
    <div class="auth-logo">
      <img
        src="https://ob-sm-systema-tickets.us-southeast-1.linodeobjects.com/web%2FLOGO%203.png"
        alt="Sonia Morales"
      />
    </div>

    <h1 class="auth-title">{{ isReset ? 'Restablecer contraseña' : '¿Olvidaste tu contraseña?' }}</h1>
    <p class="auth-subtitle" style="margin:0 0 1rem">
      {{
        isReset
          ? 'Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.'
          : 'Te enviaremos un enlace de recuperación a tu correo electrónico.'
      }}
    </p>

    <div class="auth-switch">
      ¿Recordaste tu contraseña?
      <a :href="loginHref">Inicia sesión</a>
    </div>

    <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="auth-success">{{ successMessage }}</p>

    <form class="auth-form" @submit.prevent="submit">
      <input
        v-model="email"
        class="auth-input"
        type="email"
        placeholder="Correo electrónico"
        required
        autocomplete="email"
      />

      <template v-if="isReset">
        <div class="auth-password">
          <input
            v-model="password"
            class="auth-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Nueva contraseña"
            required
            autocomplete="new-password"
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

        <div class="auth-password">
          <input
            v-model="passwordConfirmation"
            class="auth-input"
            :type="showPasswordConfirmation ? 'text' : 'password'"
            placeholder="Confirmar nueva contraseña"
            required
            autocomplete="new-password"
          />
          <button
            class="auth-eye"
            type="button"
            @click="showPasswordConfirmation = !showPasswordConfirmation"
            aria-label="Mostrar confirmación"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </template>

      <button class="auth-submit" type="submit" :disabled="loading">
        {{
          loading
            ? 'Procesando...'
            : (isReset ? 'Guardar nueva contraseña' : 'Enviar enlace de recuperación')
        }}
      </button>
    </form>
  </div>
</template>
