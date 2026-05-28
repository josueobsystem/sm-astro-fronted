<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

type SearchEvent = {
  id: string;
  title: string;
  slug: string;
  start_at?: string | null;
  venue_address?: string | null;
};

type HomeEnvelope = {
  status?: 'success' | 'error';
  data?: {
    events?: SearchEvent[];
  };
};

const formRef = ref<HTMLElement | null>(null);
const query = ref('');
const loading = ref(false);
const open = ref(false);
const results = ref<SearchEvent[]>([]);
const keyboardIndex = ref(-1);

let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let currentRequest: AbortController | null = null;

const hasQuery = computed(() => query.value.trim().length > 0);

function closeDropdown() {
  open.value = false;
  keyboardIndex.value = -1;
}

function onClickOutside(event: MouseEvent) {
  if (formRef.value && !formRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeDropdown();
  }
}

function goToSearch() {
  const value = query.value.trim();

  if (!value) {
    window.location.href = '/#eventos';
    return;
  }

  window.location.href = `/?q=${encodeURIComponent(value)}#eventos`;
}

function selectResult(eventItem: SearchEvent) {
  window.location.href = `/${eventItem.slug}`;
}

function onSubmit(event: Event) {
  event.preventDefault();
  goToSearch();
}

function onKeyboardMove(event: KeyboardEvent) {
  if (!open.value || results.value.length === 0) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    keyboardIndex.value = (keyboardIndex.value + 1) % results.value.length;
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    keyboardIndex.value = keyboardIndex.value <= 0 ? results.value.length - 1 : keyboardIndex.value - 1;
    return;
  }

  if (event.key === 'Enter' && keyboardIndex.value >= 0) {
    event.preventDefault();
    selectResult(results.value[keyboardIndex.value]);
  }
}

async function fetchSuggestions(value: string) {
  if (currentRequest) {
    currentRequest.abort();
  }

  currentRequest = new AbortController();
  loading.value = true;
  keyboardIndex.value = -1;

  try {
    const response = await fetch(`/api/public/home?q=${encodeURIComponent(value)}`, {
      signal: currentRequest.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    const payload = (await response.json()) as HomeEnvelope;
    const events = Array.isArray(payload?.data?.events) ? payload.data.events : [];

    results.value = events.slice(0, 6);
    open.value = true;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      results.value = [];
      open.value = true;
    }
  } finally {
    loading.value = false;
  }
}

watch(query, (nextValue) => {
  if (debounceHandle) {
    clearTimeout(debounceHandle);
  }

  const value = nextValue.trim();
  if (value.length < 2) {
    results.value = [];
    open.value = false;
    loading.value = false;
    return;
  }

  debounceHandle = setTimeout(() => {
    fetchSuggestions(value);
  }, 240);
});

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onEscape);

  if (debounceHandle) {
    clearTimeout(debounceHandle);
  }

  if (currentRequest) {
    currentRequest.abort();
  }
});
</script>

<template>
  <form ref="formRef" class="header-event-search" role="search" @submit="onSubmit">
    <label for="headerEventSearch" class="sr-only">Buscar eventos</label>
    <svg class="header-event-search__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 0 1 5.93 12.1l4.23 4.22a1 1 0 1 1-1.42 1.42l-4.22-4.23A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
    <input
      id="headerEventSearch"
      v-model="query"
      type="search"
      class="header-event-search__input"
      placeholder="Buscar eventos, ciudades o fechas"
      autocomplete="off"
      @focus="open = results.length > 0 || loading"
      @keydown="onKeyboardMove"
    />
    <button v-if="hasQuery" type="button" class="header-event-search__clear" @click="query = ''">
      Limpiar
    </button>
    <button type="submit" class="header-event-search__submit">Buscar</button>

    <div v-if="open" class="header-event-search__dropdown">
      <p v-if="loading" class="header-event-search__state">Buscando eventos...</p>
      <p v-else-if="results.length === 0" class="header-event-search__state">No encontramos eventos con ese término.</p>
      <ul v-else class="header-event-search__list">
        <li v-for="(eventItem, index) in results" :key="eventItem.id">
          <button
            type="button"
            class="header-event-search__item"
            :class="{ 'is-active': keyboardIndex === index }"
            @mouseenter="keyboardIndex = index"
            @click="selectResult(eventItem)"
          >
            <strong>{{ eventItem.title }}</strong>
            <span>{{ eventItem.venue_address || 'Evento' }}</span>
          </button>
        </li>
      </ul>
      <button type="button" class="header-event-search__footer" @click="goToSearch">
        Ver todos los resultados
      </button>
    </div>
  </form>
</template>
