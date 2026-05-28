<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthUser } from '@/lib/auth';

const props = defineProps<{
  user: AuthUser;
  actorType?: 'client' | 'user' | null;
  permissions?: string[];
}>();

const dropdownOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const loggingOut = ref(false);

const isClientActor = computed(() => props.actorType === 'client');
const canOpenCrm = computed(() => (props.permissions ?? []).includes('crm.requests.list'));
const userName = computed(() => props.user?.name || props.user?.email || 'Usuario');
const avatarUrl = computed(() => {
  const photoUrl = props.user?.profile_photo_url || '';

  if (photoUrl && !photoUrl.includes('ui-avatars.com')) {
    return photoUrl;
  }

  const name = encodeURIComponent(userName.value || 'U');
  return `https://ui-avatars.com/api/?name=${name}&size=96&background=ffffff&color=db2777&bold=true`;
});

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
}

function closeDropdown(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    dropdownOpen.value = false;
  }
}

async function logout() {
  if (loggingOut.value) {
    return;
  }

  loggingOut.value = true;

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } finally {
    window.location.href = '/';
  }
}

onMounted(() => document.addEventListener('click', closeDropdown));
onUnmounted(() => document.removeEventListener('click', closeDropdown));
</script>

<template>
  <div ref="menuRef" class="user-menu">
    <button
      class="user-menu-trigger"
      type="button"
      :aria-expanded="dropdownOpen"
      aria-haspopup="menu"
      @click.stop="toggleDropdown"
    >
      <img class="user-menu-avatar" :src="avatarUrl" :alt="userName" />
      <span class="user-menu-name">{{ userName }}</span>
      <svg class="user-menu-chevron" :class="{ 'is-open': dropdownOpen }" viewBox="0 0 20 20" aria-hidden="true">
        <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.58l3.3-3.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.42Z" />
      </svg>
    </button>

    <Transition name="user-menu-pop">
      <div v-if="dropdownOpen" class="user-menu-dropdown" role="menu">
        <div class="user-menu-card-head">
          <img class="user-menu-card-avatar" :src="avatarUrl" :alt="userName" />
          <div class="user-menu-card-copy">
            <p>{{ userName }}</p>
            <span>{{ props.user.email }}</span>
          </div>
        </div>

        <div class="user-menu-list">
          <a v-if="isClientActor" class="user-menu-item" href="/user/profile" role="menuitem" @click="dropdownOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" /></svg>
            <span>Mi Perfil</span>
          </a>
          <a v-if="isClientActor" class="user-menu-item" href="/user/profile?tab=tickets" role="menuitem" @click="dropdownOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 1 1 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 1 1 0-4Zm-7 7h-4v-2h4v2Zm0-4h-4v-2h4v2Zm0-4h-4V7h4v2Z" /></svg>
            <span>Mis Entradas</span>
          </a>
          <a v-if="isClientActor" class="user-menu-item" href="/user/profile?tab=reservations" role="menuitem" @click="dropdownOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Zm2 5h6V6H9v2Zm0 4h6v-2H9v2Z" /></svg>
            <span>Mis Reservas</span>
          </a>
          <a v-if="isClientActor" class="user-menu-item" href="/user/profile?tab=service-requests" role="menuitem" @click="dropdownOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10v2h3v18H4V4h3V2Zm2 4V4h6v2H9Zm-1 5h8V9H8v2Zm0 4h8v-2H8v2Z" /></svg>
            <span>Mis Solicitudes</span>
          </a>
          <a v-if="canOpenCrm" class="user-menu-item" href="/crm/kanban" role="menuitem" @click="dropdownOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h5v16H4V4Zm7 0h4v16h-4V4Zm6 0h3v16h-3V4Z" /></svg>
            <span>Panel CRM</span>
          </a>
        </div>

        <div class="user-menu-logout-wrap">
          <button class="user-menu-logout" type="button" :disabled="loggingOut" role="menuitem" @click="logout">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3h9Zm3-10H9a2 2 0 0 0-2 2v2h2V5h10v14H9v-2H7v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" /></svg>
            <span>{{ loggingOut ? 'Cerrando...' : 'Cerrar Sesión' }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
