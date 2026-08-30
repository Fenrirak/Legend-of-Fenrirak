/* =========================================================================
   Legend of Fenrirak — nav bar behaviour + shared scroll-experience kit.

   Every feature below checks for its own element before doing anything,
   so pages that don't use a feature (Home, AfterShowdowns) are completely
   unaffected — only About and Creators currently use the chapter index,
   reveal-on-scroll, progress thread, back-to-top and lightbox.
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

    /* ---- keep --topbar-h in sync, so the chapter index (and each
       chapter's scroll-margin-top) sits right below the real bar height,
       whatever that happens to be at the current screen size ----------- */
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

    /* ---- reveal-on-scroll ---------------------------------------------
       Every item also gets a staggered fallback timer, so content can
       never end up permanently invisible if the observer ever misses an
       element (an oddly-tall section, an unusual zoom level, and so on).
       Whichever fires first wins; the other is simply a no-op. -------- */
    function initReveal() {
        var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
        if (!items.length) return;

        if (!('IntersectionObserver' in window) || reduceMotion) {
            items.forEach(function (el) { el.classList.add('is-visible'); });
            return;
        }

        var timers = new Map();

        function reveal(el) {
            el.classList.add('is-visible');
            var t = timers.get(el);
            if (t) {
                clearTimeout(t);
                timers.delete(el);
            }
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    reveal(entry.target);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

        items.forEach(function (el, i) {
            io.observe(el);
            timers.set(el, setTimeout(function () { reveal(el); }, 1800 + i * 120));
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

    /* ---- chapter index scrollspy ---------------------------------------
       Highlights the pill for whichever chapter currently occupies a thin
       band near the top of the viewport. Each pill borrows its chapter's
       own accent colour via --tab-c, set inline on the link itself. ---- */
    function initSubnav() {
        var nav = document.querySelector('.subnav');
        if (!nav) return;

        var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
        var map = {};
        var targets = [];

        links.forEach(function (a) {
            var id = a.getAttribute('href').slice(1);
            var el = document.getElementById(id);
            if (el) {
                map[id] = a;
                targets.push(el);
            }
        });
        if (!targets.length) return;

        function setActive(id) {
            links.forEach(function (a) { a.classList.remove('active'); });
            if (map[id]) map[id].classList.add('active');
        }

        if (!('IntersectionObserver' in window)) {
            setActive(targets[0].id);
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setActive(entry.target.id);
            });
        }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

        targets.forEach(function (el) { io.observe(el); });
        setActive(targets[0].id);
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
        initReveal();
        initProgress();
        initBackToTop();
        initSubnav();
        initLightbox();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
