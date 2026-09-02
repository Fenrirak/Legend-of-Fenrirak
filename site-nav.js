/* =========================================================================
   Legend of Fenrirak — nav bar behaviour + shared scroll-experience kit.

   Every feature below checks for its own element before doing anything,
   so pages that don't use a feature (Home, AfterShowdowns) are completely
   unaffected — only About and Creators currently use the pop-in-on-scroll
   animation, progress thread, back-to-top and lightbox.

   Further down: a matching set of opt-in accents — a hover brighten and
   push-tilt, an ambient cursor light, a liquid dye border, scroll
   parallax, and a scroll-scrubbed text glow — following the exact same
   rule.
   ========================================================================= */

(function () {
    'use strict';

    // Quick sanity check for testing: open DevTools > Console. If this
    // line isn't there, the browser is running a different site-nav.js
    // than the one you think it is (almost always a caching issue) —
    // nothing below matters until that's fixed first.
    if (window.console) console.log('[site-nav.js] loaded — build 2026-09-02e');

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
       True scroll-scrubbed reveal: every ".pop-in" element's opacity and
       position are recalculated on every scroll frame, directly from how
       far it has scrolled up through the viewport — not a fixed-duration
       animation that gets triggered once and then plays on its own. Stop
       scrolling halfway and it sits at exactly that halfway point; scroll
       back up and it fades back down. It's driven by the scrollbar the
       same way the word-by-word brightening on a page like Jesko Jets is.

       Each item computes its OWN reveal window from its own position, so
       this behaves correctly regardless of how tall a section is (a
       10-image grid doesn't reveal its later images too early just
       because the section started near the top of the screen). Items
       that share a row get a small extra pixel offset per index, purely
       so a row of images cascades left-to-right instead of popping in
       all at once.

       No CSS class or rule ever hides this content — the only thing that
       ever sets its opacity is this function actually running. So if
       this script is ever blocked entirely, nothing is hidden in the
       first place; the page is simply static, not broken. ------------- */
    function initPopIn() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('.pop-group'));
        if (!groups.length) return;

        var entries = [];
        groups.forEach(function (group) {
            var items = Array.prototype.slice.call(group.querySelectorAll('.pop-in'));
            items.forEach(function (el, i) {
                entries.push({ el: el, offset: i * 22 });
            });
        });
        if (!entries.length) return;

        if (reduceMotion) {
            entries.forEach(function (e) { e.el.style.opacity = 1; });
            return;
        }

        function update() {
            var vh = window.innerHeight;
            var startY = vh * 0.92;
            var endY = vh * 0.52;

            entries.forEach(function (entry) {
                var top = entry.el.getBoundingClientRect().top + entry.offset;
                var progress = (startY - top) / (startY - endY);
                if (progress < 0) progress = 0;
                else if (progress > 1) progress = 1;

                if (progress >= 1) {
                    /* Fully revealed: clear the inline styles rather than
                       setting them to their "settled" values, so this
                       element's own CSS (e.g. a :hover lift on a button)
                       can take over again. An inline style always wins
                       over a stylesheet rule, even one saying "none". */
                    entry.el.style.opacity = '';
                    entry.el.style.transform = '';
                } else {
                    entry.el.style.opacity = progress;
                    entry.el.style.transform = 'translateY(' + (26 * (1 - progress)) + 'px)';
                }
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);

        /* Images loading in changes page layout after the fact — re-run
           once each one settles so positions (and thus reveal state)
           stay accurate instead of drifting from what's on screen. */
        document.querySelectorAll('img').forEach(function (img) {
            if (!img.complete) img.addEventListener('load', onScroll, { once: true });
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

    /* ---- cursor-tracked push-tilt (hover) --------------------------------
       .tilt-hover computes a small perspective tilt from the pointer's
       position inside the element and pushes the opposite way — hover
       near the left edge and it leans right, near the bottom and it
       leans up, so it reads as being "pushed" from wherever the cursor
       is rather than tilting the same fixed way every time. rAF-
       throttled so a fast mouse can't queue up more style writes than
       the browser can paint. (.glow-hover has nothing to set up here —
       it's a plain CSS :hover/:focus-within brighten now.) */
    function initTiltHover() {
        var tiltEls = Array.prototype.slice.call(document.querySelectorAll('.tilt-hover'));
        if (reduceMotion || !tiltEls.length) return;

        function bindTilt(el) {
            var maxDeg = 12;
            var frame = null, rotX = 0, rotY = 0;
            function apply() {
                el.style.transform = 'perspective(600px) rotateX(' + rotX.toFixed(2) +
                    'deg) rotateY(' + rotY.toFixed(2) + 'deg)';
                frame = null;
            }
            el.addEventListener('mousemove', function (e) {
                var rect = el.getBoundingClientRect();
                var px = (e.clientX - rect.left) / rect.width - 0.5;
                var py = (e.clientY - rect.top) / rect.height - 0.5;
                rotX = -py * maxDeg * 2;
                rotY = px * maxDeg * 2;
                if (!frame) frame = window.requestAnimationFrame(apply);
            });
            el.addEventListener('mouseleave', function () {
                rotX = 0; rotY = 0;
                el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
            });
        }

        tiltEls.forEach(bindTilt);
    }

    /* ---- liquid border (always on) --------------------------------------
       Builds the .dye-layer and its .dye-blob children once per
       .dye-hover element and traces them around the card's own edge
       instead of letting them pool in the middle — each blob has a
       fixed stop ("t", 0..1) on the perimeter, and pointOnBorder() below
       turns that into an x/y just outside whichever edge it falls on,
       plus the outward direction at that spot. The whole ring turns
       slowly on its own (drift) so it reads as a current, not a static
       decal, and while the cursor is inside the card, any blob whose
       home spot is near the pointer gets shoved further outward along
       that same direction — a bow wave that eases back in once the
       cursor moves on. The blur+contrast fusing itself is pure CSS (see
       the .dye-layer rule); this just moves the blobs. Under
       prefers-reduced-motion, blobs are placed once in their resting
       ring and never move again — still visible, just motionless. */
    function initDyeField() {
        var hosts = Array.prototype.slice.call(document.querySelectorAll('.dye-hover'));
        if (!hosts.length) return;

        var BLOB_COUNT = 16;
        var EASE = 0.08;
        var DRIFT_SPEED = 0.00028;   // full lap of the ring roughly every 60s
        var HOVER_OFFSET = 22;       // how far outside the card's edge the ring rests
        var PUSH_RADIUS = 190;       // how close the cursor must be to shove the ring
        var PUSH_STRENGTH = 60;      // extra outward travel at the very centre of a push
        // A small rotating palette of cool tones — a bright crest, the
        // card's own accent as the body colour, and a deep navy for
        // shadow — so the fused ring reads as a body of water rather
        // than one flat tint smeared into a circle.
        var PALETTE = [
            'color-mix(in srgb, var(--accent, #4a82c7) 35%, white 65%)',
            'color-mix(in srgb, var(--accent, #4a82c7) 70%, white 30%)',
            'color-mix(in srgb, var(--accent, #4a82c7) 55%, #0b1830 35%)'
        ];

        // Point at fraction t (0..1, clockwise from the top-left corner)
        // around a w-by-h rectangle, nudged outward by `offset` along the
        // normal for that edge. Treated as a sharp-cornered rectangle —
        // the card's own 16px corner radius is small enough next to the
        // blur that rounding it here would never be visible.
        function pointOnBorder(t, w, h, offset) {
            var perim = 2 * (w + h);
            var d = (((t % 1) + 1) % 1) * perim;
            if (d < w) return { x: d, y: -offset, nx: 0, ny: -1 };
            d -= w;
            if (d < h) return { x: w + offset, y: d, nx: 1, ny: 0 };
            d -= h;
            if (d < w) return { x: w - d, y: h + offset, nx: 0, ny: 1 };
            d -= w;
            return { x: -offset, y: h - d, nx: -1, ny: 0 };
        }

        hosts.forEach(function (host) {
            var layer = document.createElement('div');
            layer.className = 'dye-layer';
            var blobs = [];
            for (var i = 0; i < BLOB_COUNT; i++) {
                var blob = document.createElement('div');
                blob.className = 'dye-blob';
                blob.style.background = PALETTE[i % PALETTE.length];
                layer.appendChild(blob);
                blobs.push({ el: blob, t: i / BLOB_COUNT, x: 0, y: 0, pushX: 0, pushY: 0 });
            }
            // Behind the card's own in-flow content regardless of DOM
            // order (see the z-index: -1 rule), but inserted first anyway
            // so the source order matches the paint order for anyone
            // reading the markup later.
            host.insertBefore(layer, host.firstChild);

            function layoutOnce() {
                var rect = host.getBoundingClientRect();
                blobs.forEach(function (blob) {
                    var p = pointOnBorder(blob.t, rect.width, rect.height, HOVER_OFFSET);
                    blob.x = p.x;
                    blob.y = p.y;
                    blob.el.style.transform = 'translate(' + blob.x.toFixed(1) + 'px, ' + blob.y.toFixed(1) + 'px)';
                });
            }

            layoutOnce();
            if (reduceMotion) return;

            var pointerX = null, pointerY = null, drift = 0;

            function tick() {
                drift += DRIFT_SPEED;
                var rect = host.getBoundingClientRect();
                blobs.forEach(function (blob) {
                    var home = pointOnBorder(blob.t + drift, rect.width, rect.height, HOVER_OFFSET);
                    var pushX = 0, pushY = 0;
                    if (pointerX !== null) {
                        var dx = home.x - pointerX;
                        var dy = home.y - pointerY;
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < PUSH_RADIUS) {
                            // Squared falloff so the shove is felt strongly
                            // right where the cursor is and fades quickly
                            // away from it, like a hull rather than a tide.
                            var force = 1 - dist / PUSH_RADIUS;
                            force *= force;
                            var inv = dist > 0.01 ? 1 / dist : 0;
                            pushX = dx * inv * force * PUSH_STRENGTH;
                            pushY = dy * inv * force * PUSH_STRENGTH;
                        }
                    }
                    blob.pushX += (pushX - blob.pushX) * 0.15;
                    blob.pushY += (pushY - blob.pushY) * 0.15;
                    blob.x += (home.x - blob.x) * EASE;
                    blob.y += (home.y - blob.y) * EASE;
                    var tx = blob.x + blob.pushX;
                    var ty = blob.y + blob.pushY;
                    blob.el.style.transform = 'translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px)';
                });
                window.requestAnimationFrame(tick);
            }
            window.requestAnimationFrame(tick);

            host.addEventListener('mousemove', function (e) {
                var rect = host.getBoundingClientRect();
                pointerX = e.clientX - rect.left;
                pointerY = e.clientY - rect.top;
            });
            host.addEventListener('mouseleave', function () {
                pointerX = null;
                pointerY = null;
            });
        });
    }

    /* ---- ambient ember light ---------------------------------------------
       A single .ember-field div drifts a soft radial light toward the
       cursor. Position eases toward the pointer each frame (a simple lerp)
       rather than snapping straight to it, so it reads as something with
       a little weight — an ember drifting on its own air currents, not a
       spotlight glued to the mouse. */
    function initEmberField() {
        var field = document.querySelector('.ember-field');
        if (!field || reduceMotion) return;

        var targetX = 0, targetY = 0, curX = 0, curY = 0, raf = null;

        function tick() {
            curX += (targetX - curX) * 0.08;
            curY += (targetY - curY) * 0.08;
            field.style.setProperty('--ex', curX.toFixed(1) + 'px');
            field.style.setProperty('--ey', curY.toFixed(1) + 'px');

            if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
                raf = window.requestAnimationFrame(tick);
            } else {
                raf = null;
            }
        }

        window.addEventListener('mousemove', function (e) {
            targetX = e.clientX - window.innerWidth / 2;
            targetY = e.clientY - window.innerHeight / 2;
            if (!raf) raf = window.requestAnimationFrame(tick);
        }, { passive: true });
    }

    /* ---- scroll parallax drift --------------------------------------- */
    function initParallax() {
        var els = Array.prototype.slice.call(document.querySelectorAll('.parallax'));
        if (!els.length || reduceMotion) return;

        var items = els.map(function (el) {
            var speed = parseFloat(el.getAttribute('data-speed'));
            return { el: el, speed: isNaN(speed) ? 0.2 : speed };
        });

        function update() {
            var mid = window.innerHeight / 2;
            items.forEach(function (item) {
                var rect = item.el.getBoundingClientRect();
                var offset = (mid - (rect.top + rect.height / 2)) * item.speed;
                item.el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    /* ---- scroll-scrubbed text glow ----------------------------------------
       Splits each .reveal-text element into one <span class="word"> per
       word (plain text only — see the CSS comment for why) and brightens
       them in sequence as the block travels through the reveal band. Same
       scrub-not-trigger philosophy as initPopIn above: this is recomputed
       from scratch every frame from the element's live position, never a
       one-shot animation, so scrolling back up dims words back down. */
    function initRevealText() {
        var blocks = Array.prototype.slice.call(document.querySelectorAll('.reveal-text'));
        if (!blocks.length) return;

        var entries = blocks.map(function (block) {
            var pieces = block.textContent.split(/(\s+)/);
            block.textContent = '';
            pieces.forEach(function (chunk) {
                if (chunk === '') return;
                if (/^\s+$/.test(chunk)) {
                    block.appendChild(document.createTextNode(chunk));
                } else {
                    var span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = chunk;
                    block.appendChild(span);
                }
            });
            return { el: block, words: Array.prototype.slice.call(block.querySelectorAll('.word')) };
        });

        if (reduceMotion) {
            entries.forEach(function (entry) {
                entry.words.forEach(function (w) { w.style.opacity = 1; });
            });
            return;
        }

        function update() {
            var vh = window.innerHeight;
            /* Band is 1/6 of the screen tall, and fully resolved once
               the block's TOP reaches the bottom 1/4 of the screen
               (i.e. 3/4 of the way down). This is deliberately based
               only on screen position, not the block's own height —
               tying it to rect.height instead (as an earlier version
               did) made tall blocks finish revealing while still up
               around the middle of the screen, since a lot of scroll
               distance passes between a tall block's top and bottom. */
            var revealEnd = vh * 0.75;
            var revealStart = revealEnd + vh / 6;

            entries.forEach(function (entry) {
                var rect = entry.el.getBoundingClientRect();
                var progress = (revealStart - rect.top) / (revealStart - revealEnd);
                if (progress < 0) progress = 0;
                else if (progress > 1) progress = 1;

                var lit = progress * entry.words.length;
                entry.words.forEach(function (word, i) {
                    var diff = lit - i;
                    var op;
                    if (diff <= 0) op = 0.25;
                    else if (diff >= 1) op = 1;
                    else op = 0.25 + diff * 0.75;
                    word.style.opacity = op;
                    word.style.textShadow = op > 0.92 ? '0 0 10px rgba(242, 204, 143, 0.35)' : 'none';
                });
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    function init() {
        initGamesMenu();
        initStickyOffset();
        initPopIn();
        initProgress();
        initBackToTop();
        initLightbox();
        initTiltHover();
        initEmberField();
        initDyeField();
        initParallax();
        initRevealText();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
