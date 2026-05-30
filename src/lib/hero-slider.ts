import EmblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

function parseDelays(root: HTMLElement): number[] {
  return (root.getAttribute('data-hero-delays') || '')
    .split(',')
    .map((value) => Number(value) || 5000);
}

function syncActiveState(
  embla: EmblaCarouselType,
  slides: HTMLElement[],
  dots: HTMLButtonElement[],
): void {
  const activeIndex = embla.selectedScrollSnap();

  slides.forEach((slide, index) => {
    slide.classList.toggle('is-active', index === activeIndex);
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle('slider-indicator--active', index === activeIndex);
  });
}

function initHeroSlider(root: HTMLElement): void {
  if (root.getAttribute('data-hero-initialized') === 'true') {
    return;
  }

  const viewport = root.querySelector<HTMLElement>('.hero-swiper');
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-slide]'));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-hero-dot]'));
  const prevButton = root.querySelector<HTMLButtonElement>('[data-hero-prev]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-hero-next]');

  root.setAttribute('data-hero-initialized', 'true');

  if (!viewport || slides.length <= 1) {
    return;
  }

  const autoplayDelays = parseDelays(root);
  const autoplayPlugin = Autoplay({
    delay: (snapList) => snapList.map((_, index) => autoplayDelays[index] || 5000),
    stopOnInteraction: false,
    stopOnMouseEnter: true,
    playOnInit: true,
  });

  const embla = EmblaCarousel(
    viewport,
    {
      loop: true,
      align: 'start',
      slidesToScroll: 1,
      dragFree: false,
    },
    [autoplayPlugin],
  );

  prevButton?.addEventListener('click', () => embla.scrollPrev());
  nextButton?.addEventListener('click', () => embla.scrollNext());

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => embla.scrollTo(index));
  });

  embla.on('select', () => syncActiveState(embla, slides, dots));
  embla.on('reInit', () => syncActiveState(embla, slides, dots));

  syncActiveState(embla, slides, dots);
}

function initAllHeroSliders(): void {
  document.querySelectorAll<HTMLElement>('[data-hero-slider]').forEach((node) => {
    initHeroSlider(node);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllHeroSliders, { once: true });
} else {
  initAllHeroSliders();
}

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      if (node.matches('[data-hero-slider]')) {
        initHeroSlider(node);
      }

      node.querySelectorAll<HTMLElement>('[data-hero-slider]').forEach((childNode) => {
        initHeroSlider(childNode);
      });
    });
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
