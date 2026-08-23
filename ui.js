/* =========================================================================
   Legend of Fenrirak™, The Thunder Dragon — Online Version
   ui.js — rendering and input.
   ========================================================================= */

(function () {
    'use strict';

    const D = window.LOF_DATA;
    const E = window.LOF_ENGINE;
    let NET = null;

    let S = null;              // latest game state
    let ROOM = null;           // room code
    let unsub = null;
    let invTab = 'gear';
    let openPanel = null;      // 'merchant' | 'trade' | null
    let lastDie = null;
    let dieSpin = 0;

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function me() { return S ? E.player(S, NET.PID) : null; }
    function myTurn() { return S && S.phase === 'playing' && E.isMyTurn(S, NET.PID); }

    function notice(msg) {
        const n = $('#notice');
        if (!msg) { n.classList.remove('show'); return; }
        n.textContent = msg;
        n.classList.add('show');
        clearTimeout(notice._t);
        notice._t = setTimeout(() => n.classList.remove('show'), 5200);
    }

    function showScreen(id) {
        $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    }

    /* ------------------------------------------------------------------ */
    /* Server actions                                                      */
    /* ------------------------------------------------------------------ */

    let busy = false;
    async function act(action, args) {
        if (busy) return;
        busy = true;
        try {
            await NET.act(ROOM, action, args);
            notice('');
        } catch (err) {
            if (!err.silent) notice(err.message || String(err));
        } finally {
            busy = false;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Home screen                                                         */
    /* ------------------------------------------------------------------ */

    function initHome() {
        $('#inp-name').value = NET.localName();

        $('#btn-create').addEventListener('click', async () => {
            const name = $('#inp-name').value.trim();
            if (!name) return notice('Please enter a name first.');
            $('#btn-create').disabled = true;
            try {
                const code = await NET.createRoom(name);
                enterRoom(code);
            } catch (err) {
                notice(err.message || 'Could not create a room.');
            } finally {
                $('#btn-create').disabled = false;
            }
        });

        $('#btn-join').addEventListener('click', joinFromInput);
        $('#inp-code').addEventListener('keydown', e => {
            if (e.key === 'Enter') joinFromInput();
        });
        $('#inp-code').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
        });
    }

    async function joinFromInput() {
        const name = $('#inp-name').value.trim();
        const code = $('#inp-code').value.trim().toUpperCase();
        if (!name) return notice('Please enter a name first.');
        if (code.length !== 5) return notice('Room codes are 5 letters, like ABCDE.');
        $('#btn-join').disabled = true;
        try {
            await NET.joinRoom(code, name);
            enterRoom(code);
        } catch (err) {
            notice(err.message || 'Could not join that room.');
        } finally {
            $('#btn-join').disabled = false;
        }
    }

    function enterRoom(code) {
        ROOM = code;
        try {
            history.replaceState(null, '', location.pathname + '?room=' + code);
        } catch (e) { /* file:// — no history API */ }

        if (unsub) unsub();
        unsub = NET.subscribe(code, onState, err => notice(err.message || 'Connection lost.'));

        clearInterval(enterRoom._hb);
        enterRoom._hb = setInterval(() => {
            NET.act(ROOM, 'heartbeat', {}).catch(() => {});
            if (S && S.phase === 'playing' && S.hostId === NET.PID) {
                NET.act(ROOM, 'timeoutCheck', {}).catch(() => {});
            }
        }, 15000);
    }

    function onState(state) {
        S = state;
        if (state.phase === 'lobby') { showScreen('screen-lobby'); renderLobby(); }
        else if (state.phase === 'over') { showScreen('screen-over'); renderOver(); }
        else { showScreen('screen-game'); renderGame(); }
    }

    /* ------------------------------------------------------------------ */
    /* Lobby                                                               */
    /* ------------------------------------------------------------------ */

    function renderLobby() {
        $('#lobby-code').textContent = S.code;

        const mine = me();
        $('#class-picker').innerHTML = D.CLASS_ORDER.map(id => {
            const c = D.CLASSES[id];
            const taken = S.players.filter(p => p.cls === id).length;
            const full = taken >= D.RULES.maxPerClass && (!mine || mine.cls !== id);
            const sel = mine && mine.cls === id;
            return '<div class="class-card' + (sel ? ' selected' : '') + (full ? ' full' : '') +
                '" data-cls="' + id + '">' +
                '<img src="' + esc(c.art) + '" alt="' + esc(c.name) + '">' +
                '<div class="cname">' + esc(c.name) + '</div>' +
                '<div class="cstat">' + c.hp + ' HP &middot; ' + c.defence + ' Defence</div>' +
                '<div class="cmoves">' +
                    c.moves.map(m => esc(m.name) + ' — ' + m.damage + ' dmg (' + m.energy + 'E)').join('<br>') +
                    '<br><span class="gold">' + esc(c.ability.name) + '</span>' +
                '</div>' +
                '<div class="cstat">' + taken + ' / ' + D.RULES.maxPerClass + ' taken</div>' +
                '</div>';
        }).join('');

        $$('#class-picker .class-card').forEach(el => {
            el.addEventListener('click', () => {
                if (el.classList.contains('full')) return;
                const id = el.dataset.cls;
                act('chooseClass', { cls: (mine && mine.cls === id) ? null : id });
            });
        });

        $('#roster').innerHTML = S.players.map(p =>
            '<li>' +
            '<span class="dot' + (p.cls ? ' ready' : '') + '"></span>' +
            '<span class="' + (p.id === NET.PID ? 'you' : '') + '">' + esc(p.name) +
                (p.id === NET.PID ? ' (you)' : '') + '</span>' +
            '<span class="tag">' + (p.cls ? esc(D.CLASSES[p.cls].name) : 'choosing…') +
                (p.id === S.hostId ? ' · host' : '') + '</span>' +
            '</li>'
        ).join('');

        const isHost = S.hostId === NET.PID;
        const everyoneReady = S.players.length >= D.RULES.minPlayers &&
                              S.players.every(p => p.cls);
        $('#btn-start').style.display = isHost ? '' : 'none';
        $('#btn-start').disabled = !everyoneReady;
        $('#lobby-hint').textContent = !isHost
            ? 'Waiting for the host to begin.'
            : S.players.length < D.RULES.minPlayers
                ? 'You need at least 2 players.'
                : everyoneReady ? 'Everyone is ready.' : 'Waiting for everyone to pick a class.';
    }

    function initLobby() {
        $('#btn-start').addEventListener('click', () => act('startGame', {}));
        $('#btn-copy').addEventListener('click', () => {
            const link = location.origin + location.pathname + '?room=' + S.code;
            const text = navigator.clipboard ? link : null;
            if (text) {
                navigator.clipboard.writeText(link)
                    .then(() => notice('Invite link copied.'))
                    .catch(() => notice(link));
            } else {
                notice(link);
            }
        });
        $('#btn-leave-lobby').addEventListener('click', leaveRoom);
    }

    async function leaveRoom() {
        try { await NET.act(ROOM, 'leave', {}); } catch (e) { /* ignore */ }
        if (unsub) unsub();
        unsub = null;
        clearInterval(enterRoom._hb);
        ROOM = null; S = null;
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        showScreen('screen-home');
    }

    /* ------------------------------------------------------------------ */
    /* Game — turn banner                                                  */
    /* ------------------------------------------------------------------ */

    function renderGame() {
        renderBanner();
        renderBoard();
        renderHero();
        renderActions();
        renderLog();
        renderInventory();
        renderModal();
    }

    function renderBanner() {
        const banner = $('#turn-banner');
        if (S.phase === 'order') {
            const waiting = S.players.filter(p => p.orderRoll === null).map(p => p.name);
            banner.className = 'turn-banner' + (me() && me().orderRoll === null ? ' mine' : '');
            banner.innerHTML = '<span class="who">Rolling for turn order</span>' +
                '<span class="muted">' +
                (waiting.length ? 'Waiting on ' + esc(waiting.join(', ')) : 'Setting the order…') +
                '</span>';
            return;
        }
        const cur = E.currentPlayer(S);
        const mine = cur && cur.id === NET.PID;
        banner.className = 'turn-banner' + (mine ? ' mine' : '');
        banner.innerHTML =
            '<span class="who">' + (mine ? 'Your turn' : esc(cur ? cur.name : '—') + '’s turn') + '</span>' +
            '<span class="muted">Turn ' + S.turnNo + '</span>' +
            '<span class="timer" id="turn-timer"></span>';
    }

    function tickTimer() {
        const el = $('#turn-timer');
        if (!el || !S || S.phase !== 'playing') return;
        const left = Math.max(0, D.RULES.turnTimeoutMs - (Date.now() - (S.turnStartedAt || 0)));
        el.textContent = left > 0 ? Math.ceil(left / 1000) + 's left' : 'skipping…';
    }
    setInterval(tickTimer, 1000);

    /* ------------------------------------------------------------------ */
    /* Game — board                                                        */
    /* ------------------------------------------------------------------ */

    function tokensOn(index) {
        return S.players.filter(p => p.cls && p.pos === index).map(p => {
            const c = D.CLASSES[p.cls];
            return '<div class="token' + (p.id === NET.PID ? ' me' : '') + '" title="' +
                esc(p.name) + ' — ' + p.hp + '/' + p.maxHp + ' HP" ' +
                'style="background-image:url(\'' + esc(c.art) + '\')"></div>';
        }).join('');
    }

    function squareKind(sq) {
        if (sq.arena) return 'arena';
        if (sq.key === 'start') return 'start';
        if (sq.key === 'gate') return 'gate';
        if (sq.action === 'battle') return 'battle';
        if (sq.action === 'chest' || sq.action === 'crimson_keep') return 'chest';
        if (sq.action === 'heal') return 'heal';
        if (sq.scenery === 'water' || sq.action === 'sea_of_castout') return 'water';
        return 'plain';
    }

    function renderBoard() {
        const anyoneInArena = S.players.some(p => p.pos === D.ARENA_INDEX);

        const html = D.BOARD.map(sq => {
            if (sq.arena) {
                return '<div class="arena' + (anyoneInArena ? ' lit' : '') + '">' +
                    '<div class="arena-glow"></div>' +
                    '<div class="arena-inner">' +
                        '<img class="dragon" src="Fenrirak.png" alt="Fenrirak">' +
                        '<div class="arena-title">Fenrirak’s Arena</div>' +
                        '<div class="arena-sub">The Thunder Dragon</div>' +
                        '<div class="arena-note">' + esc(sq.text) + '</div>' +
                        '<div class="tokens">' + tokensOn(sq.i) + '</div>' +
                    '</div>' +
                '</div>';
            }
            const kind = squareKind(sq);
            const badge = sq.stop ? 'STOP' : (sq.optionalStop ? 'OPTIONAL' : '');
            return '<div class="sq kind-' + kind + (sq.stop ? ' stop' : '') + '" ' +
                'style="grid-row:' + (sq.row + 1) + ';grid-column:' + (sq.col + 1) + '">' +
                (badge ? '<div class="sq-badge">' + badge + '</div>' : '') +
                '<div class="sq-name">' + esc(sq.name) + '</div>' +
                '<div class="sq-text">' + esc(sq.text) + '</div>' +
                '<div class="tokens">' + tokensOn(sq.i) + '</div>' +
            '</div>';
        }).join('');

        $('#board').innerHTML = html;
    }

    /* ------------------------------------------------------------------ */
    /* Game — hero panel                                                   */
    /* ------------------------------------------------------------------ */

    function renderHero() {
        const p = me();
        if (!p || !p.cls) { $('#side-hero').innerHTML = ''; return; }
        const c = D.CLASSES[p.cls];
        const weapon = E.equippedWeapon(p);
        const armour = E.equippedArmour(p);
        const wDef = weapon ? D.ITEMS[weapon.id] : null;
        const aDef = armour ? D.ITEMS[armour.id] : null;

        $('#side-hero').innerHTML =
            '<div class="hero-panel">' +
                '<img src="' + esc(c.art) + '" alt="' + esc(c.name) + '">' +
                '<div style="flex:1;min-width:0">' +
                    '<div class="hname">' + esc(p.name) + '</div>' +
                    '<div class="hsub">' + esc(c.name) + ' &middot; on ' +
                        esc(E.square(p.pos).name) + '</div>' +
                    '<div class="bar hp"><i style="width:' +
                        Math.max(0, Math.round(p.hp / p.maxHp * 100)) + '%"></i></div>' +
                    '<div class="barlabel"><span>' + p.hp + ' / ' + p.maxHp + ' HP</span>' +
                        '<span>Defence ' + E.totalDefence(S, p) + '</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="stat-row">' +
                '<span class="chip">Coins <b>' + p.coins + '</b></span>' +
                '<span class="chip">Energy <b>' + p.energy + '</b></span>' +
                '<span class="chip">Attack <b>+' + E.totalAttackBonus(p) + '</b></span>' +
                '<span class="chip">Key fragments <b>' + p.keyFragments + '/3</b></span>' +
                '<span class="chip">Chest keys <b>' + p.chestKeys + '</b></span>' +
                '<span class="chip">Steaks <b>' + p.steaks.raw + ' raw, ' +
                    p.steaks.cooked + ' seared</b></span>' +
            '</div>' +
            '<div class="stat-row">' +
                '<span class="chip">Weapon <b>' + esc(wDef ? wDef.name : 'none') + '</b>' +
                    (weapon && weapon.uses != null ? ' <span class="muted">(' +
                        weapon.uses + ' uses)</span>' : '') + '</span>' +
                '<span class="chip">Armour <b>' + esc(aDef ? aDef.name : 'none') + '</b>' +
                    (armour && armour.uses != null ? ' <span class="muted">(' +
                        armour.uses + ' hits)</span>' : '') + '</span>' +
            '</div>' +
            '<div class="stat-row">' + S.players.filter(x => x.id !== p.id && x.cls).map(x =>
                '<span class="chip">' + esc(x.name) + ' <b>' + x.hp + '/' + x.maxHp +
                '</b> · ' + x.keyFragments + '/3 keys</span>').join('') + '</div>';
    }

    /* ------------------------------------------------------------------ */
    /* Game — action buttons                                               */
    /* ------------------------------------------------------------------ */

    function renderActions() {
        const p = me();
        const box = $('#side-actions');
        if (!p) { box.innerHTML = ''; return; }

        if (S.phase === 'order') {
            box.innerHTML = '<button class="btn primary" id="a-order"' +
                (p.orderRoll !== null ? ' disabled' : '') + '>' +
                (p.orderRoll !== null ? 'Rolled ' + p.orderRoll : 'Roll for turn order') +
                '</button>';
            const b = $('#a-order');
            if (b) b.addEventListener('click', () => act('rollForOrder', {}));
            return;
        }

        const mine = myTurn();
        const blocked = !!S.battle || !!S.pending;
        const cls = D.CLASSES[p.cls];
        const abilityReady = S.turnNo - p.lastAbilityTurn >= D.RULES.abilityCooldownTurns;

        const buttons = [];
        buttons.push(btn('a-move', 'Roll & move', 'primary',
            !mine || blocked || p.hasMoved));
        buttons.push(btn('a-ability', cls.ability.name, '',
            !mine || blocked || !abilityReady ||
            (cls.ability.id === 'agile' && p.hasMoved)));
        buttons.push(btn('a-shop', 'Visit the Merchant', '', !mine || blocked));
        buttons.push(btn('a-trade', 'Propose a trade', '', S.players.length < 2));
        buttons.push(btn('a-steak-raw', 'Eat raw steak', '', p.steaks.raw < 1));
        buttons.push(btn('a-steak-cooked', 'Eat seared steak', '', p.steaks.cooked < 1));
        buttons.push(btn('a-end', 'End turn', '', !mine || blocked));

        box.innerHTML = '<div class="actions">' + buttons.join('') + '</div>' +
            (blocked ? '<div class="muted" style="margin-top:10px;font-size:13px">' +
                (S.battle ? 'A battle is under way.' : 'Resolve the square first.') + '</div>' : '');

        bind('a-move', () => act('rollMove', {}));
        bind('a-ability', () => {
            if (cls.ability.id === 'illusion') return openIllusion();
            act('useAbility', {});
        });
        bind('a-shop', () => { openPanel = 'merchant'; renderModal(); });
        bind('a-trade', () => { openPanel = 'trade'; renderModal(); });
        bind('a-steak-raw', () => act('eatSteak', { type: 'raw' }));
        bind('a-steak-cooked', () => act('eatSteak', { type: 'cooked' }));
        bind('a-end', () => act('endTurn', {}));
    }

    function btn(id, label, cls, disabled) {
        return '<button class="btn ' + (cls || '') + '" id="' + id + '"' +
            (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
    }
    function bind(id, fn) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    /* ------------------------------------------------------------------ */
    /* Game — log                                                          */
    /* ------------------------------------------------------------------ */

    function renderLog() {
        $('#log').innerHTML = (S.log || []).slice(-60).reverse()
            .map(l => '<div class="t-' + esc(l.tone) + '">' + esc(l.t) + '</div>').join('');
    }

    /* ------------------------------------------------------------------ */
    /* Game — inventory                                                    */
    /* ------------------------------------------------------------------ */

    function renderInventory() {
        const p = me();
        if (!p) return;

        $('#inv-tabs').innerHTML = [
            ['gear', 'Weapons & armour (' + p.inventory.length + ')'],
            ['powerups', 'Power-ups (' + p.powerups.length + ')'],
            ['potions', 'Potions (' + p.potions.length + ')']
        ].map(([k, label]) =>
            '<button class="btn small' + (invTab === k ? ' active' : '') +
            '" data-tab="' + k + '">' + esc(label) + '</button>').join('');

        $$('#inv-tabs button').forEach(b => b.addEventListener('click', () => {
            invTab = b.dataset.tab;
            renderInventory();
        }));

        let html = '';
        if (invTab === 'gear') {
            const cls = D.CLASSES[p.cls];
            const canSwap = S.turnNo - p.lastEquipTurn >= D.RULES.equipCooldownTurns;
            html = p.inventory.map(inst => {
                const d = D.ITEMS[inst.id];
                const equipped = inst.uid === p.weaponUid || inst.uid === p.armourUid;
                const usable = d.kind === 'weapon'
                    ? d.subtype === cls.weaponType
                    : (d.subtype === 'any' || d.subtype === cls.armourType);
                return '<div class="item' + (equipped ? ' equipped' : '') +
                    (d.treasure ? ' treasure' : '') + '">' +
                    '<div class="iname">' + esc(d.name) + '</div>' +
                    '<div class="itext">' + esc(d.text) + '</div>' +
                    '<div class="imeta">' + (d.kind === 'weapon' ? 'Weapon · ' : 'Armour · ') +
                        esc(d.subtype === 'any' ? 'any class' : d.subtype) +
                        (inst.uses != null ? ' · ' + inst.uses + ' uses left' : '') +
                        (equipped ? ' · equipped' : '') + '</div>' +
                    (equipped || !usable
                        ? (usable ? '' : '<div class="imeta" style="color:#d2635a">A ' +
                            esc(cls.name) + ' cannot use this — trade it away.</div>')
                        : '<button class="btn small" data-equip="' + inst.uid + '"' +
                          (canSwap && myTurn() && !S.battle ? '' : ' disabled') + '>Equip</button>') +
                    '</div>';
            }).join('') || '<div class="muted">Nothing yet.</div>';
        } else if (invTab === 'powerups') {
            html = p.powerups.map(c => {
                const d = D.POWERUPS[c.id];
                return '<div class="item powerup">' +
                    '<div class="iname">' + esc(d.name) + '</div>' +
                    '<div class="itext">' + esc(d.text) + '</div>' +
                    '<button class="btn small" data-pu="' + c.uid + '">Play card</button>' +
                    '</div>';
            }).join('') || '<div class="muted">No power-up cards.</div>';
        } else {
            html = p.potions.map(c => {
                const d = D.POWERUPS[c.id];
                return '<div class="item powerup">' +
                    '<div class="iname">' + esc(d.name) + ' potion</div>' +
                    '<div class="itext">' + esc(d.text) + '</div>' +
                    '<button class="btn small" data-po="' + c.uid + '">Drink</button>' +
                    '</div>';
            }).join('') || '<div class="muted">No potions.</div>';
        }

        $('#inventory').innerHTML = '<div class="item-grid">' + html + '</div>';
        $$('#inventory [data-equip]').forEach(b =>
            b.addEventListener('click', () => act('equip', { uid: b.dataset.equip })));
        $$('#inventory [data-pu]').forEach(b =>
            b.addEventListener('click', () => act('usePowerup', { uid: b.dataset.pu })));
        $$('#inventory [data-po]').forEach(b =>
            b.addEventListener('click', () => act('usePotion', { uid: b.dataset.po })));
    }

    /* ------------------------------------------------------------------ */
    /* Modals                                                              */
    /* ------------------------------------------------------------------ */

    function closeModal() {
        $('#modal-back').classList.remove('show');
        $('#modal').innerHTML = '';
    }

    function showModal(html, dismissable) {
        const back = $('#modal-back');
        $('#modal').innerHTML = html;
        back.classList.add('show');
        back.dataset.dismissable = dismissable ? '1' : '0';
    }

    function renderModal() {
        const incoming = (S.trades || []).find(t =>
            t.status === 'open' && t.toId === NET.PID);

        if (S.battle) return renderBattleModal();
        if (S.pending && S.pending.playerId === NET.PID) return renderPendingModal();
        if (incoming) return renderIncomingTrade(incoming);
        if (openPanel === 'merchant') return renderMerchant();
        if (openPanel === 'trade') return renderTradeBuilder();
        closeModal();
    }

    /* ---- battle ---- */

    function renderBattleModal() {
        const b = S.battle;
        const p = me();
        const isPvp = b.kind === 'pvp';
        const a = E.player(S, b.aId);
        const foe = isPvp ? E.player(S, b.bId) : D.ENEMIES[b.enemyId];
        const involved = b.aId === NET.PID || b.bId === NET.PID;
        const actorId = E.battleActorId(S);
        const myMove = actorId === NET.PID;

        const foeArt = isPvp ? D.CLASSES[foe.cls].art : 'Fenrirak.png';
        const foeHp = isPvp ? foe.hp : b.enemyHp;
        const foeMax = isPvp ? foe.maxHp : b.enemyMaxHp;

        const meSide = involved ? (b.aId === NET.PID ? a : foe) : a;
        const themSide = involved ? (b.aId === NET.PID ? foe : a) : foe;

        let body =
            '<h2>' + (isPvp ? 'Player Battle' : esc(foe.name)) + '</h2>' +
            '<div class="sub">' +
                (b.illusion ? 'A Mage’s illusion — you will earn coins only. ' : '') +
                (involved ? (myMove ? 'Your move.' : 'Waiting for the other side…')
                          : 'You are watching this battle.') +
            '</div>' +
            '<div class="battle-top">' +
                sideHtml(a, D.CLASSES[a.cls].art, a.hp, a.maxHp, a.name, 'hp') +
                '<div class="battle-vs">VS</div>' +
                sideHtml(foe, foeArt, foeHp, foeMax,
                         isPvp ? foe.name : foe.name, isPvp ? 'hp' : 'enemy') +
            '</div>';

        if (b.lastRoll != null) {
            body += '<div class="die' + (dieSpin ? ' rolling' : '') + '">' + b.lastRoll + '</div>' +
                '<div class="muted" style="text-align:center;font-size:13px">' +
                (b.lastRoll % 2 === 0 ? 'Even — a hit.' : 'Odd — a miss.') + '</div>';
        }

        if (involved && myMove) {
            if (b.phase === 'roll') {
                body += '<div class="modal-actions" style="justify-content:center">' +
                    '<button class="btn primary" id="b-roll">Roll to strike</button></div>';
            } else {
                const moves = E.availableMoves(S, NET.PID);
                body += '<h3 style="margin-top:18px">Choose your attack</h3><div class="moves">' +
                    moves.map(m =>
                        '<button class="move" data-move="' + esc(m.id) + '"' +
                        (m.usable ? '' : ' disabled') + '>' +
                        '<div class="mname">' + esc(m.name) + '</div>' +
                        '<div class="mmeta">' + m.damage + ' damage · needs ' + m.energy +
                            ' energy' + (m.usable ? '' : ' (you have ' + p.energy + ')') + '</div>' +
                        '</button>').join('') + '</div>';
            }
        }

        if (involved) {
            body += '<div class="modal-actions">' +
                (p.steaks.cooked > 0 ? '<button class="btn small" id="b-cooked">Eat seared steak</button>' : '') +
                (p.steaks.raw > 0 ? '<button class="btn small" id="b-raw">Eat raw steak</button>' : '') +
                (p.powerups.length ? '<button class="btn small" id="b-pu">Play a power-up</button>' : '') +
                (p.potions.length ? '<button class="btn small" id="b-po">Drink a potion</button>' : '') +
                '</div>';
        }

        body += '<h3 style="margin-top:18px">Battle log</h3>' +
            '<div class="log" style="max-height:150px">' +
            (S.log || []).slice(-12).reverse()
                .map(l => '<div class="t-' + esc(l.tone) + '">' + esc(l.t) + '</div>').join('') +
            '</div>';

        showModal(body, false);

        bind('b-roll', () => { dieSpin = 1; act('battleRoll', {}); });
        $$('#modal [data-move]').forEach(el =>
            el.addEventListener('click', () => act('battleAttack', { moveId: el.dataset.move })));
        bind('b-cooked', () => act('eatSteak', { type: 'cooked' }));
        bind('b-raw', () => act('eatSteak', { type: 'raw' }));
        bind('b-pu', () => pickFrom('Play a power-up',
            p.powerups.map(c => ({ id: c.uid, name: D.POWERUPS[c.id].name, text: D.POWERUPS[c.id].text })),
            uid => act('usePowerup', { uid: uid })));
        bind('b-po', () => pickFrom('Drink a potion',
            p.potions.map(c => ({ id: c.uid, name: D.POWERUPS[c.id].name, text: D.POWERUPS[c.id].text })),
            uid => act('usePotion', { uid: uid })));
    }

    function sideHtml(who, art, hp, max, name, barClass) {
        return '<div class="battle-side">' +
            '<img src="' + esc(art) + '" alt="' + esc(name) + '">' +
            '<div class="bname">' + esc(name) + '</div>' +
            '<div class="bar ' + barClass + '"><i style="width:' +
                Math.max(0, Math.round(hp / max * 100)) + '%"></i></div>' +
            '<div class="barlabel"><span>' + hp + ' / ' + max + '</span></div>' +
            '</div>';
    }

    function pickFrom(title, options, onPick) {
        showModal('<h2>' + esc(title) + '</h2><div class="item-grid">' +
            options.map(o => '<div class="item"><div class="iname">' + esc(o.name) + '</div>' +
                '<div class="itext">' + esc(o.text || '') + '</div>' +
                '<button class="btn small" data-pick="' + esc(o.id) + '">Use</button></div>').join('') +
            '</div><div class="modal-actions"><button class="btn" id="pick-cancel">Back</button></div>', true);
        $$('#modal [data-pick]').forEach(b =>
            b.addEventListener('click', () => onPick(b.dataset.pick)));
        bind('pick-cancel', renderModal);
    }

    /* ---- pending square choices ---- */

    function renderPendingModal() {
        const pend = S.pending;
        const p = me();
        let body = '';

        if (pend.type === 'optional_stop') {
            body = '<h2>Optional stop</h2><div class="sub">' + esc(pend.prompt) + '</div>' +
                '<div class="modal-actions">' +
                '<button class="btn primary" data-choice="stop">Stop here</button>' +
                '<button class="btn" data-choice="go">Keep moving (' + p.movesLeft + ' left)</button>' +
                '</div>';
        } else if (pend.type === 'pot') {
            body = '<h2>The Pot</h2><div class="sub">' + esc(pend.prompt) + '</div>' +
                '<div class="sub">You have ' + p.steaks.raw + ' raw steak' +
                (p.steaks.raw === 1 ? '' : 's') + '. Seared steak heals 10 HP instead of 5.</div>' +
                '<div class="modal-actions">' +
                '<button class="btn primary" data-choice="' + p.steaks.raw + '">Cook all ' +
                    p.steaks.raw + '</button>' +
                '<button class="btn" data-choice="0">Cook none</button>' +
                '</div>';
        } else if (pend.type === 'chest' || pend.type === 'crimson_keep') {
            body = '<h2>' + (pend.type === 'chest' ? 'A Chest' : 'The Crimson Keep') + '</h2>' +
                '<div class="sub">' + esc(pend.prompt) + '</div>' +
                '<div class="item-grid">' + pend.options.map(id => {
                    const d = D.ITEMS[id];
                    return '<div class="item treasure"><div class="iname">' + esc(d.name) + '</div>' +
                        '<div class="itext">' + esc(d.text) + '</div>' +
                        '<div class="imeta">' + (d.kind === 'weapon' ? 'Weapon · ' + d.subtype
                            : 'Armour · any class') + '</div>' +
                        '<button class="btn small" data-choice="' + esc(id) + '">Take it</button></div>';
                }).join('') + '</div>';
        } else if (pend.type === 'sea_of_castout') {
            body = '<h2>Sea of Castout</h2><div class="sub">' + esc(pend.prompt) + '</div>' +
                '<div class="item-grid">' + pend.options.map(o => {
                    const d = D.ITEMS[o.id];
                    return '<div class="item"><div class="iname">' + esc(d.name) + '</div>' +
                        '<div class="itext">' + esc(d.text) + '</div>' +
                        '<button class="btn small danger" data-choice="' + esc(o.uid) +
                        '">Let it go</button></div>';
                }).join('') + '</div>';
        } else if (pend.type === 'pvp_avoid') {
            const other = E.player(S, pend.otherId);
            body = '<h2>Cloak of Invisibility</h2>' +
                '<div class="sub">' + esc(pend.prompt) + ' You have run into ' +
                esc(other ? other.name : 'another player') + '.</div>' +
                '<div class="modal-actions">' +
                '<button class="btn primary" data-choice="avoid">Slip away</button>' +
                '<button class="btn danger" data-choice="fight">Fight anyway</button></div>';
        }

        showModal(body, false);
        $$('#modal [data-choice]').forEach(b => b.addEventListener('click', () => {
            let c = b.dataset.choice;
            if (pend.type === 'pot') c = parseInt(c, 10);
            act('resolvePending', { choice: c });
        }));
    }

    /* ---- merchant ---- */

    function renderMerchant() {
        const p = me();
        const cls = D.CLASSES[p.cls];

        const gear = D.MERCHANT_GEAR.filter(id => {
            const d = D.ITEMS[id];
            if (d.kind === 'weapon') return d.subtype === cls.weaponType;
            return true;
        });

        const gearHtml = gear.map(id => {
            const d = D.ITEMS[id];
            const stock = S.merchant.gear[id] || 0;
            const afford = p.coins >= d.price && stock > 0;
            return '<div class="shop-item' + (stock ? '' : ' out') + '">' +
                '<div class="sname">' + esc(d.name) + '</div>' +
                '<div class="itext">' + esc(d.text) + '</div>' +
                '<div class="sprice">' + d.price + ' coins</div>' +
                '<div class="sstock">' + (stock ? stock + ' in stock' : 'sold out') + '</div>' +
                '<button class="btn small" data-buy-gear="' + esc(id) + '"' +
                    (afford ? '' : ' disabled') + '>Buy</button></div>';
        }).join('');

        const potionHtml = Object.keys(D.MERCHANT_POTIONS).map(id => {
            const d = D.POWERUPS[id];
            const price = D.MERCHANT_POTIONS[id].price;
            const stock = S.merchant.potions[id] || 0;
            const afford = p.coins >= price && stock > 0;
            return '<div class="shop-item' + (stock ? '' : ' out') + '">' +
                '<div class="sname">' + esc(d.name) + '</div>' +
                '<div class="itext">' + esc(d.text) + '</div>' +
                '<div class="sprice">' + price + ' coins</div>' +
                '<div class="sstock">' + (stock ? stock + ' left' : 'sold out') + '</div>' +
                '<button class="btn small" data-buy-potion="' + esc(id) + '"' +
                    (afford ? '' : ' disabled') + '>Buy</button></div>';
        }).join('');

        showModal(
            '<h2>The Poor Merchant</h2>' +
            '<div class="sub">You have <span class="gold">' + p.coins + ' coins</span>. ' +
            'Buying anything ends your turn — choose carefully.</div>' +
            '<h3>Weapons &amp; armour</h3><div class="shop-grid">' + gearHtml + '</div>' +
            '<h3 style="margin-top:18px">Potions</h3><div class="shop-grid">' + potionHtml + '</div>' +
            '<div class="modal-actions"><button class="btn" id="shop-close">Leave the stall</button></div>',
            true);

        $$('#modal [data-buy-gear]').forEach(b => b.addEventListener('click', () => {
            openPanel = null;
            act('buy', { kind: 'gear', id: b.dataset.buyGear });
        }));
        $$('#modal [data-buy-potion]').forEach(b => b.addEventListener('click', () => {
            openPanel = null;
            act('buy', { kind: 'potion', id: b.dataset.buyPotion });
        }));
        bind('shop-close', () => { openPanel = null; renderModal(); });
    }

    /* ---- illusion ---- */

    function openIllusion() {
        const others = S.players.filter(x => x.id !== NET.PID && x.cls);
        const enemies = Object.keys(D.ENEMIES).filter(id => !D.ENEMIES[id].noIllusion);
        showModal('<h2>Illusion</h2>' +
            '<div class="sub">Conjure an enemy and set it on another player. They lose their ' +
            'turn to the fight and keep only the coins.</div>' +
            '<h3>Enemy</h3><select id="il-enemy">' +
                enemies.map(id => '<option value="' + id + '">' + esc(D.ENEMIES[id].name) +
                    ' — ' + D.ENEMIES[id].hp + ' HP</option>').join('') + '</select>' +
            '<h3 style="margin-top:14px">Victim</h3><select id="il-target">' +
                others.map(o => '<option value="' + esc(o.id) + '">' + esc(o.name) + ' (' +
                    esc(D.CLASSES[o.cls].name) + ')</option>').join('') + '</select>' +
            '<div class="modal-actions">' +
            '<button class="btn primary" id="il-go">Cast (roll even to succeed)</button>' +
            '<button class="btn" id="il-cancel">Cancel</button></div>', true);

        bind('il-go', () => act('useAbility', {
            enemyId: $('#il-enemy').value,
            targetPlayerId: $('#il-target').value
        }));
        bind('il-cancel', renderModal);
    }

    /* ---- trading ---- */

    function bundleUi(p, prefix) {
        return '<div class="stat-row">' +
            '<label class="chip">Coins <input type="number" min="0" max="' + p.coins +
                '" value="0" id="' + prefix + '-coins" style="width:70px;padding:2px 6px"></label>' +
            '<label class="chip">Raw steaks <input type="number" min="0" max="' + p.steaks.raw +
                '" value="0" id="' + prefix + '-raw" style="width:60px;padding:2px 6px"></label>' +
            '<label class="chip">Seared <input type="number" min="0" max="' + p.steaks.cooked +
                '" value="0" id="' + prefix + '-cooked" style="width:60px;padding:2px 6px"></label>' +
            '<label class="chip">Key fragments <input type="number" min="0" max="' + p.keyFragments +
                '" value="0" id="' + prefix + '-keys" style="width:55px;padding:2px 6px"></label>' +
            '<label class="chip">Chest keys <input type="number" min="0" max="' + p.chestKeys +
                '" value="0" id="' + prefix + '-chest" style="width:55px;padding:2px 6px"></label>' +
            '</div>' +
            '<div class="item-grid" style="margin-top:10px">' +
                p.inventory.map(i => checkItem(prefix + '-item', i.uid, D.ITEMS[i.id].name)).join('') +
                p.powerups.map(i => checkItem(prefix + '-pu', i.uid, D.POWERUPS[i.id].name + ' (card)')).join('') +
                p.potions.map(i => checkItem(prefix + '-po', i.uid, D.POWERUPS[i.id].name + ' (potion)')).join('') +
            '</div>';
    }

    function checkItem(name, uid, label) {
        return '<label class="item" style="cursor:pointer">' +
            '<input type="checkbox" data-group="' + name + '" value="' + esc(uid) + '"> ' +
            esc(label) + '</label>';
    }

    function readBundle(prefix) {
        const num = id => Math.max(0, parseInt(($('#' + id) || {}).value || '0', 10) || 0);
        const checked = group => $$('[data-group="' + group + '"]')
            .filter(c => c.checked).map(c => c.value);
        return {
            coins: num(prefix + '-coins'),
            rawSteaks: num(prefix + '-raw'),
            cookedSteaks: num(prefix + '-cooked'),
            keyFragments: num(prefix + '-keys'),
            chestKeys: num(prefix + '-chest'),
            items: checked(prefix + '-item'),
            powerups: checked(prefix + '-pu'),
            potions: checked(prefix + '-po')
        };
    }

    function renderTradeBuilder() {
        const p = me();
        const others = S.players.filter(x => x.id !== NET.PID && x.cls);
        if (!others.length) { openPanel = null; return closeModal(); }

        const targetId = renderTradeBuilder._target &&
            others.some(o => o.id === renderTradeBuilder._target)
            ? renderTradeBuilder._target : others[0].id;
        const other = E.player(S, targetId);

        showModal('<h2>Propose a trade</h2>' +
            '<div class="sub">Both sides have to agree. No stealing, no scamming.</div>' +
            '<h3>Trade with</h3><select id="tr-target">' +
                others.map(o => '<option value="' + esc(o.id) + '"' +
                    (o.id === targetId ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') +
            '</select>' +
            '<h3 style="margin-top:16px">You give</h3>' + bundleUi(p, 'give') +
            '<h3 style="margin-top:16px">You want from ' + esc(other.name) + '</h3>' +
                bundleUi(other, 'want') +
            '<div class="modal-actions">' +
            '<button class="btn primary" id="tr-send">Send offer</button>' +
            '<button class="btn" id="tr-close">Cancel</button></div>', true);

        $('#tr-target').addEventListener('change', e => {
            renderTradeBuilder._target = e.target.value;
            renderTradeBuilder();
        });
        bind('tr-send', () => {
            const give = readBundle('give');
            const want = readBundle('want');
            openPanel = null;
            act('proposeTrade', { toId: targetId, give: give, want: want });
        });
        bind('tr-close', () => { openPanel = null; renderModal(); });
    }

    function describeBundle(b) {
        const parts = [];
        if (b.coins) parts.push(b.coins + ' coins');
        if (b.rawSteaks) parts.push(b.rawSteaks + ' raw steak');
        if (b.cookedSteaks) parts.push(b.cookedSteaks + ' seared steak');
        if (b.keyFragments) parts.push(b.keyFragments + ' key fragment(s)');
        if (b.chestKeys) parts.push(b.chestKeys + ' chest key(s)');
        const n = (b.items || []).length + (b.powerups || []).length + (b.potions || []).length;
        if (n) parts.push(n + ' card(s)');
        return parts.length ? parts.join(', ') : 'nothing';
    }

    function renderIncomingTrade(t) {
        const from = E.player(S, t.fromId);
        showModal('<h2>Trade offer</h2>' +
            '<div class="sub">' + esc(from.name) + ' wants to trade.</div>' +
            '<div class="card"><b class="gold">They give you:</b><br>' +
                esc(describeBundle(t.give)) + '</div>' +
            '<div class="card" style="margin-top:10px"><b class="gold">They want from you:</b><br>' +
                esc(describeBundle(t.want)) + '</div>' +
            '<div class="modal-actions">' +
            '<button class="btn primary" id="tr-yes">Accept</button>' +
            '<button class="btn danger" id="tr-no">Decline</button></div>', false);
        bind('tr-yes', () => act('respondTrade', { tradeId: t.id, accept: true }));
        bind('tr-no', () => act('respondTrade', { tradeId: t.id, accept: false }));
    }

    /* ------------------------------------------------------------------ */
    /* Victory                                                             */
    /* ------------------------------------------------------------------ */

    function renderOver() {
        closeModal();
        const w = E.player(S, S.winner);
        $('#over-body').innerHTML =
            '<div class="victory">' +
            '<div class="vtitle">Victory</div>' +
            '<img src="Fenrirak.png" alt="Fenrirak">' +
            '<h2>' + esc(w ? w.name : 'Someone') + ' has slain Fenrirak.</h2>' +
            '<p class="muted">' + (w && w.id === NET.PID
                ? 'The Thunder Dragon falls to you. The legend is yours.'
                : 'The Thunder Dragon falls to another. Try again.') + '</p>' +
            '<div class="modal-actions" style="justify-content:center">' +
            '<button class="btn primary" id="over-home">Back to the start</button></div>' +
            '</div>';
        bind('over-home', () => {
            if (unsub) unsub();
            clearInterval(enterRoom._hb);
            ROOM = null; S = null;
            try { history.replaceState(null, '', location.pathname); } catch (e) {}
            showScreen('screen-home');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */
    /* ------------------------------------------------------------------ */

    function boot() {
        NET = window.LOF_NET;
        initHome();
        initLobby();

        $('#modal-back').addEventListener('click', (e) => {
            if (e.target === $('#modal-back') &&
                $('#modal-back').dataset.dismissable === '1') {
                openPanel = null;
                renderModal();
            }
        });

        $('#btn-leave-game').addEventListener('click', leaveRoom);

        const params = new URLSearchParams(location.search);
        const room = (params.get('room') || '').toUpperCase();
        if (/^[A-Z]{5}$/.test(room)) {
            $('#inp-code').value = room;
            if (NET.localName()) {
                $('#inp-name').value = NET.localName();
                NET.joinRoom(room, NET.localName())
                    .then(() => enterRoom(room))
                    .catch(err => notice(err.message || 'Could not rejoin that room.'));
            } else {
                notice('Enter a name, then press Join to enter room ' + room + '.');
            }
        }
        showScreen(ROOM ? 'screen-lobby' : 'screen-home');
    }

    if (window.LOF_NET) boot();
    else window.addEventListener('lof-net-ready', boot, { once: true });
})();
