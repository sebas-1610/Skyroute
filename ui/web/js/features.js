/**
 * SkyRoute Scroll Reveal Animation
 */
(function() {
    'use strict';

    const cards = document.querySelectorAll('[data-reveal]');
    if (!cards.length) return;

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const idx = [...cards].indexOf(el);
                el.style.animationDelay = `${idx * 80}ms`;
                el.classList.add('visible');
                io.unobserve(el);
            }
        });
    }, { threshold: 0.15 });

    cards.forEach(c => io.observe(c));
})();