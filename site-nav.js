/* =========================================================================
   Legend of Fenrirak — nav bar behaviour + shared scroll-experience kit.

   Every feature below checks for its own element before doing anything,
   so pages that don't use a feature (Home, AfterShowdowns) are completely
   unaffected — only About and Creators currently use the pop-in-on-scroll
   animation, progress thread, back-to-top and lightbox.
   ========================================================================= */

(function () {
    'use strict';

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Games dropdown (hover on desktop is CSS-only; this adds
       tap/click toggling for touch screens, plus Escape to close) ------- */
    function initGamesMenu() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
        if (!groups.length) return;

        function closeAll(except) {
            groups.forEach(function (g) {
                if (g === except) return;
                g.classList.remove('open');
                var t = g.querySelector('.nav-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        }

        groups.forEach(function (group) {
            var trigger = group.querySelector('.nav-trigger');
            if (!trigger) return;

            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                var willOpen = !group.classList.contains('open');
                closeAll(group);
                group.classList.toggle('open', willOpen);
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest || !e.target.closest('.nav-group')) closeAll(null);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll(null);
        });
    }

    /* ---- keep --topbar-h in sync, so each section's scroll-margin-top
       clears the real bar height, whatever that is at the current
       screen size ----------------------------------------------------- */
    function initStickyOffset() {
        var bar = document.querySelector('.topbar');
        if (!bar) return;

        function measure() {
            document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
        }

        measure();
        window.addEventListener('resize', measure);
        if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
    }

    /* ---- pop-in-as-you-scroll ------------------------------------------
       Real scrollytelling-style reveals — built entirely from this file
       plus the CSS in site-nav.css, with no external library and no
       network request, so it can never be silently broken by a blocked
       or slow CDN in whatever environment the page is opened in.

       Every ".pop-group" (a whole chapter / crew row) fires once, the
       moment it scrolls into view: its ".pop-in" children get ".is-visible"
       added one after another, a fraction of a second apart (via a small
       per-item transition-delay), which is what makes them cascade in
       rather than the whole block fading in as one flat rectangle.

       Safety net: the hidden state only ever exists once html.js-ready is
       set below, and only for the length of this function — every group
       also gets a fallback timer that force-reveals it regardless, so
       nothing can end up permanently invisible even in an odd edge case
       (an unusually tall section, a browser quirk, and so on). --------- */
    function initPopIn() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('.pop-group'));
        if (!groups.length) return;

        document.documentElement.classList.add('js-ready');

        function revealGroup(group) {
            if (group.dataset.popped) return;
            group.dataset.popped = 'true';

            var items = Array.prototype.slice.call(group.querySelectorAll('.pop-in'));
            items.forEach(function (el, i) {
                el.style.transitionDelay = reduceMotion ? '0s' : (i * 0.1) + 's';
                el.classList.add('is-visible');
            });
        }

        if (reduceMotion || !('IntersectionObserver' in window)) {
            groups.forEach(revealGroup);
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    revealGroup(entry.target);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

        groups.forEach(function (group) {
            io.observe(group);
            /* Genuine last resort only — IntersectionObserver is reliable
               in every current browser, so this should in practice never
               fire. It exists purely so a section can't stay invisible
               forever in some freak edge case, without undermining the
               scroll-triggered reveal for anyone reading at a normal
               pace (the earlier version of this fired within 3–4
               seconds of load, which was fast enough to reveal whole
               sections before they'd even been scrolled to — that bug
               is what this longer delay fixes). */
            setTimeout(function () { revealGroup(group); }, 20000);
        });
    }

    /* ---- top scroll-progress thread ------------------------------------ */
    function initProgress() {
        var bar = document.querySelector('.scroll-progress');
        if (!bar) return;

        var ticking = false;
        function update() {
            var doc = document.documentElement;
            var max = doc.scrollHeight - doc.clientHeight;
            var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
            bar.style.width = pct + '%';
            ticking = false;
        }
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(update);
                ticking = true;
            }
        }
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    /* ---- floating back-to-top ------------------------------------------ */
    function initBackToTop() {
        var btn = document.querySelector('.back-to-top');
        if (!btn) return;

        function onScroll() {
            btn.classList.toggle('visible', window.scrollY > 500);
        }
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ---- lightbox -------------------------------------------------------
       Any <img class="lightbox-trigger"> opens an enlarged view on click. */
    function initLightbox() {
        var triggers = Array.prototype.slice.call(document.querySelectorAll('.lightbox-trigger'));
        if (!triggers.length) return;

        var overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML =
            '<button type="button" class="lightbox-close" aria-label="Close image">&times;</button>' +
            '<img alt="">';
        document.body.appendChild(overlay);

        var img = overlay.querySelector('img');
        var closeBtn = overlay.querySelector('.lightbox-close');
        var lastFocused = null;

        function open(src, alt) {
            lastFocused = document.activeElement;
            img.src = src;
            img.alt = alt || '';
            overlay.classList.add('open');
            closeBtn.focus();
        }
        function close() {
            overlay.classList.remove('open');
            img.src = '';
            if (lastFocused && lastFocused.focus) lastFocused.focus();
        }

        triggers.forEach(function (t) {
            t.addEventListener('click', function () {
                open(t.currentSrc || t.src, t.alt);
            });
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });
    }

    function init() {
        initGamesMenu();
        initStickyOffset();
        initPopIn();
        initProgress();
        initBackToTop();
        initLightbox();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
