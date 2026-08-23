/* =========================================================================
   Legend of Fenrirak™, The Thunder Dragon — Online Version
   engine.js — the rules.

   Every function here takes the shared game state and mutates it in place.
   The networking layer runs these inside a Firestore transaction, so the
   engine itself never touches the network and stays easy to reason about.
   ========================================================================= */

(function (global) {
    'use strict';

    const D = global.LOF_DATA;
    const R = D.RULES;

    /* ------------------------------------------------------------------ */
    /* Small helpers                                                       */
    /* ------------------------------------------------------------------ */

    let uidCounter = 0;
    function uid(prefix) {
        uidCounter += 1;
        return (prefix || 'u') + '_' + Date.now().toString(36) + '_' +
               uidCounter.toString(36) + Math.floor(Math.random() * 1296).toString(36);
    }

    function d6() { return 1 + Math.floor(Math.random() * 6); }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function log(state, text, tone) {
        state.log.push({ t: text, tone: tone || 'info', at: Date.now() });
        if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
    }

    function player(state, pid) {
        return state.players.find(p => p.id === pid) || null;
    }

    function square(i) {
        return D.BOARD[Math.max(0, Math.min(D.BOARD.length - 1, i))];
    }

    function itemDef(id) { return D.ITEMS[id]; }

    function ownedItem(p, itemUid) {
        return p.inventory.find(it => it.uid === itemUid) || null;
    }

    function equippedWeapon(p) {
        return p.weaponUid ? ownedItem(p, p.weaponUid) : null;
    }

    function equippedArmour(p) {
        return p.armourUid ? ownedItem(p, p.armourUid) : null;
    }

    function defOf(inst) { return inst ? D.ITEMS[inst.id] : null; }

    /* ------------------------------------------------------------------ */
    /* Derived stats                                                       */
    /* ------------------------------------------------------------------ */

    function buffTotal(p, kind) {
        return (p.buffs || []).reduce((n, b) => n + (b.kind === kind ? b.value : 0), 0);
    }

    // Defence reduces damage taken: class defence + armour + any defence buffs.
    function totalDefence(state, p) {
        const cls = D.CLASSES[p.cls];
        const armour = defOf(equippedArmour(p));
        return (cls ? cls.defence : 0) +
               (armour && armour.defence ? armour.defence : 0) +
               buffTotal(p, 'defence');
    }

    // Attack bonus added to any move that already deals damage.
    function totalAttackBonus(p) {
        const weapon = defOf(equippedWeapon(p));
        const armour = defOf(equippedArmour(p));
        return (weapon && weapon.attack ? weapon.attack : 0) +
               (armour && armour.attack ? armour.attack : 0) +
               buffTotal(p, 'damage');
    }

    // Modifier applied to every dice roll this player makes.
    function diceModifier(p) {
        const armour = defOf(equippedArmour(p));
        return (armour && armour.dice ? armour.dice : 0) + buffTotal(p, 'dice');
    }

    function consumeBuffs(p, kind) {
        p.buffs = (p.buffs || []).filter(b => {
            if (b.kind !== kind) return true;
            b.uses -= 1;
            return b.uses > 0;
        });
    }

    function addBuff(p, kind, value, uses) {
        p.buffs = p.buffs || [];
        p.buffs.push({ kind: kind, value: value, uses: uses });
    }

    /* ------------------------------------------------------------------ */
    /* Decks                                                               */
    /* ------------------------------------------------------------------ */

    function drawItem(state, p, count) {
        const drawn = [];
        for (let n = 0; n < count; n++) {
            if (!state.decks.item.length) {
                state.decks.item = shuffle(D.ITEM_DECK.slice());
                log(state, 'The item deck was reshuffled.', 'muted');
            }
            const id = state.decks.item.shift();
            const inst = { uid: uid('it'), id: id, uses: D.ITEMS[id].uses || null };
            p.inventory.push(inst);
            drawn.push(D.ITEMS[id].name);
        }
        if (drawn.length) log(state, p.name + ' drew ' + drawn.join(' and ') + '.', 'item');
    }

    function drawPowerup(state, p, count) {
        const drawn = [];
        for (let n = 0; n < count; n++) {
            if (!state.decks.powerup.length) {
                state.decks.powerup = shuffle(D.POWERUP_DECK.slice());
            }
            const id = state.decks.powerup.shift();
            p.powerups.push({ uid: uid('pu'), id: id });
            drawn.push(D.POWERUPS[id].name);
        }
        if (drawn.length) log(state, p.name + ' drew ' + drawn.join(', ') + '.', 'item');
    }

    /* ------------------------------------------------------------------ */
    /* Game setup                                                          */
    /* ------------------------------------------------------------------ */

    function makeRoomCode() {
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '';
        for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * 26)];
        return s;
    }

    function createGame(code, hostId, hostName) {
        const state = {
            code: code,
            hostId: hostId,
            phase: 'lobby',              // lobby | order | playing | over
            players: [],
            turnOrder: [],
            turnIndex: 0,
            turnNo: 0,
            decks: {
                item: shuffle(D.ITEM_DECK.slice()),
                powerup: shuffle(D.POWERUP_DECK.slice())
            },
            merchant: buildMerchantStock(),
            battle: null,
            pending: null,
            trades: [],
            log: [],
            winner: null,
            turnStartedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1
        };
        addPlayer(state, hostId, hostName);
        log(state, 'Room ' + code + ' opened. Waiting for adventurers…', 'muted');
        return state;
    }

    function buildMerchantStock() {
        const stock = { gear: {}, potions: {} };
        D.MERCHANT_GEAR.forEach(id => { stock.gear[id] = 1; });
        Object.keys(D.MERCHANT_POTIONS).forEach(id => {
            stock.potions[id] = D.MERCHANT_POTIONS[id].stock;
        });
        return stock;
    }

    function addPlayer(state, pid, name) {
        if (state.phase !== 'lobby') return fail('The game has already started.');
        if (player(state, pid)) return ok();
        if (state.players.length >= R.maxPlayers) return fail('This room is full (6 players).');

        state.players.push({
            id: pid,
            name: (name || 'Adventurer').slice(0, 16),
            cls: null,
            ready: false,
            pos: D.START_INDEX,
            hp: 0, maxHp: 0,
            coins: R.startingCoins,
            energy: R.startingEnergy,
            inventory: [],
            powerups: [],
            potions: [],
            steaks: { raw: 0, cooked: 0 },
            keyFragments: 0,
            chestKeys: 0,
            weaponUid: null,
            armourUid: null,
            buffs: [],
            orderRoll: null,
            turnsTaken: 0,
            lastEquipTurn: -99,
            lastAbilityTurn: -99,
            pendingIllusion: null,
            movesLeft: 0,
            hasMoved: false,
            connected: true,
            lastSeen: Date.now()
        });
        log(state, (name || 'An adventurer') + ' joined the room.', 'muted');
        return ok();
    }

    function removePlayer(state, pid) {
        const idx = state.players.findIndex(p => p.id === pid);
        if (idx < 0) return ok();
        if (state.phase === 'lobby') {
            const gone = state.players[idx];
            state.players.splice(idx, 1);
            log(state, gone.name + ' left the room.', 'muted');
            if (state.hostId === pid && state.players.length) {
                state.hostId = state.players[0].id;
            }
        } else {
            state.players[idx].connected = false;
        }
        return ok();
    }

    function chooseClass(state, pid, clsId) {
        if (state.phase !== 'lobby') return fail('The game has already started.');
        const p = player(state, pid);
        if (!p) return fail('You are not in this room.');
        if (clsId && !D.CLASSES[clsId]) return fail('Unknown class.');

        if (clsId) {
            const taken = state.players.filter(x => x.cls === clsId && x.id !== pid).length;
            if (taken >= R.maxPerClass) {
                return fail('There are already two ' + D.CLASSES[clsId].name + 's.');
            }
        }
        p.cls = clsId;
        p.ready = !!clsId;
        return ok();
    }

    function startGame(state, pid) {
        if (state.phase !== 'lobby') return fail('Already started.');
        if (pid !== state.hostId) return fail('Only the host can start the game.');
        if (state.players.length < R.minPlayers) return fail('You need at least 2 players.');
        if (state.players.some(p => !p.cls)) return fail('Everyone must choose a class first.');

        state.players.forEach(p => {
            const cls = D.CLASSES[p.cls];
            p.maxHp = cls.hp;
            p.hp = cls.hp;
            p.energy = R.startingEnergy;

            const w = { uid: uid('it'), id: cls.starterWeapon, uses: D.ITEMS[cls.starterWeapon].uses };
            const a = { uid: uid('it'), id: cls.starterArmour, uses: D.ITEMS[cls.starterArmour].uses };
            p.inventory.push(w, a);
            p.weaponUid = w.uid;
            p.armourUid = a.uid;
            p.orderRoll = null;
        });

        state.phase = 'order';
        log(state, 'Everyone rolls for turn order. Highest goes first.', 'system');
        return ok();
    }

    function rollForOrder(state, pid) {
        if (state.phase !== 'order') return fail('Not rolling for order right now.');
        const p = player(state, pid);
        if (!p) return fail('You are not in this room.');
        if (p.orderRoll !== null) return fail('You have already rolled.');

        p.orderRoll = d6();
        log(state, p.name + ' rolled a ' + p.orderRoll + ' for turn order.', 'roll');

        if (state.players.every(x => x.orderRoll !== null)) {
            // Ties are rerolled, exactly as the rules say.
            const byRoll = {};
            state.players.forEach(x => {
                byRoll[x.orderRoll] = (byRoll[x.orderRoll] || 0) + 1;
            });
            const tiedValues = Object.keys(byRoll).filter(v => byRoll[v] > 1);
            if (tiedValues.length) {
                state.players.forEach(x => {
                    if (tiedValues.indexOf(String(x.orderRoll)) >= 0) x.orderRoll = null;
                });
                log(state, 'A tie! Those players reroll.', 'system');
                return ok();
            }

            state.turnOrder = state.players.slice()
                .sort((a, b) => b.orderRoll - a.orderRoll)
                .map(x => x.id);
            state.phase = 'playing';
            state.turnIndex = 0;
            state.turnNo = 1;
            state.turnStartedAt = Date.now();
            beginTurn(state);
        }
        return ok();
    }

    /* ------------------------------------------------------------------ */
    /* Turn flow                                                           */
    /* ------------------------------------------------------------------ */

    function currentPlayer(state) {
        if (state.phase !== 'playing') return null;
        return player(state, state.turnOrder[state.turnIndex]);
    }

    function beginTurn(state) {
        const p = currentPlayer(state);
        if (!p) return;
        p.hasMoved = false;
        p.movesLeft = 0;
        state.turnStartedAt = Date.now();

        // A Mage's illusion forces a fight before anything else.
        if (p.pendingIllusion) {
            const enemyId = p.pendingIllusion;
            p.pendingIllusion = null;
            log(state, p.name + ' is ambushed by an illusion of the ' +
                       D.ENEMIES[enemyId].name + '!', 'battle');
            startEnemyBattle(state, p, enemyId, p.pos, true);
        }
    }

    function isMyTurn(state, pid) {
        const p = currentPlayer(state);
        return !!p && p.id === pid;
    }

    function endTurn(state, pid) {
        if (state.phase !== 'playing') return fail('The game is not running.');
        if (!isMyTurn(state, pid)) return fail('It is not your turn.');
        if (state.battle) return fail('Finish the battle first.');
        if (state.pending) return fail('Resolve the square first.');
        return advanceTurn(state);
    }

    function advanceTurn(state) {
        const p = currentPlayer(state);
        if (p) {
            // End of turn: roll for a raw steak.
            const roll = d6();
            if (R.steakRolls.indexOf(roll) >= 0) {
                p.steaks.raw += 1;
                log(state, p.name + ' rolled a ' + roll + ' and found a raw steak.', 'muted');
            }
            // Defence buffs last one turn.
            p.buffs = (p.buffs || []).filter(b => b.kind !== 'defence');
            p.turnsTaken += 1;
            p.energy = R.startingEnergy;
        }

        let guard = 0;
        do {
            state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
            if (state.turnIndex === 0) state.turnNo += 1;
            guard += 1;
        } while (guard < state.turnOrder.length && !currentPlayer(state));

        beginTurn(state);
        return ok();
    }

    function checkTimeout(state, now) {
        if (state.phase !== 'playing') return false;
        if ((now - (state.turnStartedAt || 0)) < R.turnTimeoutMs) return false;
        const p = currentPlayer(state);
        if (!p) return false;
        log(state, p.name + ' was away too long — turn skipped.', 'muted');
        state.battle = null;
        state.pending = null;
        advanceTurn(state);
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Movement                                                            */
    /* ------------------------------------------------------------------ */

    function rollMove(state, pid) {
        if (state.phase !== 'playing') return fail('The game is not running.');
        if (!isMyTurn(state, pid)) return fail('It is not your turn.');
        if (state.battle) return fail('You are in a battle.');
        if (state.pending) return fail('Resolve the square first.');
        const p = currentPlayer(state);
        if (p.hasMoved) return fail('You have already moved this turn.');

        const raw = d6();
        const mod = diceModifier(p) + (p.agileBonus || 0);
        const total = Math.max(1, raw + mod);
        p.agileBonus = 0;
        consumeBuffs(p, 'dice');
        p.hasMoved = true;

        log(state, p.name + ' rolled a ' + raw +
                   (mod ? ' (' + (mod > 0 ? '+' : '') + mod + ' = ' + total + ')' : '') + '.', 'roll');

        return walk(state, p, total);
    }

    // Step square by square so Stop squares can interrupt movement.
    function walk(state, p, steps) {
        let remaining = steps;
        while (remaining > 0) {
            if (p.pos >= D.ARENA_INDEX) break;
            p.pos += 1;
            remaining -= 1;
            const sq = square(p.pos);

            if (remaining > 0 && sq.optionalStop) {
                p.movesLeft = remaining;
                state.pending = {
                    type: 'optional_stop',
                    playerId: p.id,
                    squareIndex: p.pos,
                    prompt: sq.name + ' — ' + sq.text
                };
                return ok();
            }
            if (remaining > 0 && sq.stop) {
                log(state, p.name + ' must stop at ' + sq.name + '.', 'muted');
                remaining = 0;
            }
        }
        p.movesLeft = 0;
        return landOn(state, p);
    }

    function landOn(state, p) {
        const sq = square(p.pos);
        log(state, p.name + ' landed on ' + sq.name + '.', 'move');

        // Two characters on the same square means a forced PvP battle.
        const rival = state.players.find(x =>
            x.id !== p.id && x.cls && x.pos === p.pos && p.pos !== D.START_INDEX);
        if (rival) {
            const cloak = defOf(equippedArmour(p));
            const rivalCloak = defOf(equippedArmour(rival));
            if ((cloak && cloak.avoidPvp) || (rivalCloak && rivalCloak.avoidPvp)) {
                const holder = (cloak && cloak.avoidPvp) ? p : rival;
                state.pending = {
                    type: 'pvp_avoid',
                    playerId: holder.id,
                    otherId: holder.id === p.id ? rival.id : p.id,
                    squareIndex: p.pos,
                    prompt: 'The Cloak of Invisibility can slip you past this fight.'
                };
                return ok();
            }
            return startPvp(state, p, rival);
        }

        return resolveSquare(state, p, sq);
    }

    function resolveSquare(state, p, sq) {
        switch (sq.action) {
            case 'draw_item':
                drawItem(state, p, sq.count);
                return ok();

            case 'draw_powerup':
                drawPowerup(state, p, sq.count);
                return ok();

            case 'draw_item_key':
                drawItem(state, p, sq.count);
                p.chestKeys += 1;
                log(state, p.name + ' pockets a chest key.', 'item');
                return ok();

            case 'coins':
                p.coins += sq.coins;
                log(state, p.name + ' found ' + sq.coins + ' coins.', 'item');
                return ok();

            case 'heal': {
                const before = p.hp;
                p.hp = Math.min(p.maxHp, p.hp + sq.value);
                log(state, p.name + ' healed ' + (p.hp - before) + ' HP at ' + sq.name + '.', 'heal');
                return ok();
            }

            case 'spring': {
                log(state, 'The spring launches ' + p.name + ' two spaces forward!', 'move');
                return walk(state, p, sq.value);
            }

            case 'pot':
                if (p.steaks.raw > 0) {
                    state.pending = {
                        type: 'pot', playerId: p.id,
                        prompt: 'You may cook as many raw steaks as you like.'
                    };
                } else {
                    log(state, 'No raw steak to cook.', 'muted');
                }
                return ok();

            case 'chest':
                if (p.chestKeys < 1) {
                    log(state, p.name + ' has no chest key — the chest stays shut.', 'muted');
                    return ok();
                }
                state.pending = {
                    type: 'chest', playerId: p.id,
                    options: D.TREASURE_POOL.slice(),
                    prompt: 'Spend a chest key and choose one treasure. Any class may wear ' +
                            'armour found in a chest.'
                };
                return ok();

            case 'crimson_keep': {
                const cls = D.CLASSES[p.cls];
                const options = D.TREASURE_POOL.filter(id => {
                    const it = D.ITEMS[id];
                    if (it.kind === 'armour') return true;
                    return it.subtype === cls.weaponType;
                });
                state.pending = {
                    type: 'crimson_keep', playerId: p.id, options: options,
                    prompt: 'The Crimson Keep. Choose one item that suits a ' + cls.name + '.'
                };
                return ok();
            }

            case 'sea_of_castout': {
                const losable = p.inventory
                    .filter(it => it.uid !== null)
                    .map(it => ({ uid: it.uid, id: it.id, name: D.ITEMS[it.id].name }));
                if (!losable.length) {
                    log(state, 'The whirlpool finds nothing to take from ' + p.name + '.', 'muted');
                    return ok();
                }
                state.pending = {
                    type: 'sea_of_castout', playerId: p.id, options: losable,
                    prompt: 'A whirlpool drags something under. Choose an item to lose.'
                };
                return ok();
            }

            case 'gate':
                if (p.keyFragments >= D.KEY_FRAGMENTS_NEEDED) {
                    log(state, p.name + ' turns three key fragments — the Gate grinds open!', 'system');
                } else {
                    log(state, 'The Gate refuses ' + p.name + '. Back to the Start.', 'death');
                    sendToStart(state, p, false);
                }
                return ok();

            case 'battle':
                return startEnemyBattle(state, p, sq.enemy, sq.i, false);

            default:
                return ok();
        }
    }

    function sendToStart(state, p, keepCoins) {
        p.pos = D.START_INDEX;
        p.hp = p.maxHp;
        p.energy = R.startingEnergy;
        p.buffs = [];
        if (keepCoins === false) { /* items, coins and power-ups are always kept */ }
    }

    /* ------------------------------------------------------------------ */
    /* Battles                                                             */
    /* ------------------------------------------------------------------ */

    function startEnemyBattle(state, p, enemyId, squareIndex, isIllusion) {
        const e = D.ENEMIES[enemyId];
        p.energy = R.startingEnergy;
        state.battle = {
            kind: 'pve',
            enemyId: enemyId,
            enemyHp: e.hp,
            enemyMaxHp: e.hp,
            enemyEnergy: R.startingEnergy,
            squareIndex: (squareIndex === undefined || squareIndex === null) ? p.pos : squareIndex,
            illusion: !!isIllusion,
            aId: p.id,
            turn: 'a',
            phase: 'roll',
            lastRoll: null
        };
        log(state, p.name + ' faces the ' + e.name + '!', 'battle');
        return ok();
    }

    function startPvp(state, a, b) {
        a.energy = R.startingEnergy;
        b.energy = R.startingEnergy;

        // Dark Iron Armour always strikes first.
        const aArmour = defOf(equippedArmour(a));
        const bArmour = defOf(equippedArmour(b));
        let first = 'a';
        if (bArmour && bArmour.firstStrikePvp && !(aArmour && aArmour.firstStrikePvp)) first = 'b';

        state.battle = {
            kind: 'pvp',
            aId: a.id,
            bId: b.id,
            squareIndex: a.pos,
            turn: first,
            phase: 'roll',
            lastRoll: null
        };
        log(state, a.name + ' and ' + b.name + ' clash on ' + square(a.pos).name + '!', 'battle');
        return ok();
    }

    function battleActorId(state) {
        const b = state.battle;
        if (!b) return null;
        if (b.kind === 'pve') return b.turn === 'a' ? b.aId : null;   // null = the enemy AI
        return b.turn === 'a' ? b.aId : b.bId;
    }

    function availableMoves(state, pid) {
        const b = state.battle;
        const p = player(state, pid);
        if (!b || !p) return [];
        const cls = D.CLASSES[p.cls];
        let moves = cls.moves.slice();

        // Dragon Scale Armour lends you Fenrirak's attacks in PvP.
        const armour = defOf(equippedArmour(p));
        if (b.kind === 'pvp' && armour && armour.fenrirakMovesPvp) {
            moves = moves.concat(D.ENEMIES.fenrirak.moves.map(m => ({
                id: 'fenrirak_' + m.id, name: m.name + ' (Fenrirak)',
                damage: m.damage, energy: m.energy
            })));
        }
        return moves.map(m => ({
            id: m.id, name: m.name, damage: m.damage, energy: m.energy,
            usable: p.energy >= m.energy
        }));
    }

    function battleRoll(state, pid) {
        const b = state.battle;
        if (!b) return fail('There is no battle.');
        if (battleActorId(state) !== pid) return fail('It is not your move.');
        if (b.phase !== 'roll') return fail('You have already rolled.');

        const p = player(state, pid);
        const raw = d6();
        b.lastRoll = raw;
        log(state, p.name + ' rolled a ' + raw + ' — ' + (raw % 2 === 0 ? 'hit!' : 'miss.'),
            raw % 2 === 0 ? 'roll' : 'muted');

        if (raw % 2 === 0) {
            b.phase = 'act';
        } else {
            passBattleTurn(state);
        }
        return ok();
    }

    function battleAttack(state, pid, moveId) {
        const b = state.battle;
        if (!b) return fail('There is no battle.');
        if (battleActorId(state) !== pid) return fail('It is not your move.');
        if (b.phase !== 'act') return fail('Roll to see if you connect first.');

        const p = player(state, pid);
        const move = availableMoves(state, pid).find(m => m.id === moveId);
        if (!move) return fail('Unknown move.');
        if (!move.usable) return fail('Not enough energy for ' + move.name + '.');

        const bonus = totalAttackBonus(p);
        const raw = move.damage > 0 ? move.damage + bonus : 0;

        if (b.kind === 'pve') {
            const e = D.ENEMIES[b.enemyId];
            const dealt = Math.max(0, raw - e.defence);
            b.enemyHp = Math.max(0, b.enemyHp - dealt);
            log(state, p.name + ' used ' + move.name + ' for ' + dealt + ' damage.', 'hit');
            afterAttack(state, p, move);
            if (b.enemyHp <= 0) return winPve(state, p);
        } else {
            const other = player(state, pid === b.aId ? b.bId : b.aId);
            const dealt = Math.max(0, raw - totalDefence(state, other));
            other.hp = Math.max(0, other.hp - dealt);
            log(state, p.name + ' used ' + move.name + ' on ' + other.name +
                       ' for ' + dealt + ' damage.', 'hit');
            damageArmour(state, other);
            afterAttack(state, p, move);
            if (other.hp <= 0) return winPvp(state, p, other);
        }

        passBattleTurn(state);
        return ok();
    }

    function afterAttack(state, p, move) {
        p.energy += 1;                       // energy is gained by attacking, never spent
        consumeBuffs(p, 'damage');

        const weaponInst = equippedWeapon(p);
        const weapon = defOf(weaponInst);
        if (weapon && weapon.healPerMove) {
            const before = p.hp;
            p.hp = Math.min(p.maxHp, p.hp + weapon.healPerMove);
            if (p.hp > before) {
                log(state, 'The ' + weapon.name + ' knits ' + (p.hp - before) + ' HP back.', 'heal');
            }
        }
        if (weaponInst && weaponInst.uses !== null && weaponInst.uses !== undefined) {
            weaponInst.uses -= 1;
            if (weaponInst.uses <= 0) {
                log(state, p.name + "'s " + weapon.name + ' shatters!', 'death');
                p.inventory = p.inventory.filter(it => it.uid !== weaponInst.uid);
                p.weaponUid = null;
            }
        }
    }

    function damageArmour(state, target) {
        const inst = equippedArmour(target);
        if (!inst || inst.uses === null || inst.uses === undefined) return;
        inst.uses -= 1;
        if (inst.uses <= 0) {
            log(state, target.name + "'s " + D.ITEMS[inst.id].name + ' falls apart!', 'death');
            target.inventory = target.inventory.filter(it => it.uid !== inst.uid);
            target.armourUid = null;
        }
    }

    function passBattleTurn(state) {
        const b = state.battle;
        b.phase = 'roll';
        b.turn = b.turn === 'a' ? 'b' : 'a';
        state.turnStartedAt = Date.now();
        if (b.kind === 'pve' && b.turn === 'b') runEnemyTurn(state);
    }

    // Deterministic monster AI: roll to hit, then always the highest damage
    // attack it currently has the energy for.
    function runEnemyTurn(state) {
        const b = state.battle;
        if (!b || b.kind !== 'pve' || b.turn !== 'b') return;
        const e = D.ENEMIES[b.enemyId];
        const p = player(state, b.aId);

        const roll = d6();
        b.lastRoll = roll;
        if (roll % 2 !== 0) {
            log(state, 'The ' + e.name + ' rolled a ' + roll + ' and misses.', 'muted');
            b.enemyEnergy += 0;
            b.phase = 'roll';
            b.turn = 'a';
            return;
        }

        const usable = e.moves.filter(m => b.enemyEnergy >= m.energy);
        const move = usable.sort((x, y) => y.damage - x.damage)[0] || e.moves[0];
        const dealt = Math.max(0, move.damage - totalDefence(state, p));
        p.hp = Math.max(0, p.hp - dealt);
        b.enemyEnergy += 1;
        log(state, 'The ' + e.name + ' used ' + move.name + ' for ' + dealt + ' damage.', 'enemy');
        damageArmour(state, p);

        if (p.hp <= 0) { losePve(state, p); return; }

        b.phase = 'roll';
        b.turn = 'a';
    }

    function winPve(state, p) {
        const b = state.battle;
        const e = D.ENEMIES[b.enemyId];
        const sq = D.BOARD.find(s => s.enemy === b.enemyId) || {};

        log(state, p.name + ' defeated the ' + e.name + '!', 'system');

        if (e.boss) {
            state.battle = null;
            state.phase = 'over';
            state.winner = p.id;
            log(state, '★ ' + p.name + ' has slain Fenrirak. The legend is theirs. ★', 'system');
            return ok();
        }

        if (sq.coins) {
            p.coins += sq.coins;
            log(state, p.name + ' claims ' + sq.coins + ' coins.', 'item');
        }
        if (!b.illusion) {
            if (sq.keyFragment) {
                p.keyFragments = Math.min(D.KEY_FRAGMENTS_NEEDED, p.keyFragments + sq.keyFragment);
                log(state, p.name + ' recovers a key fragment (' + p.keyFragments + '/3).', 'item');
            }
            if (sq.chestKey) {
                p.chestKeys += sq.chestKey;
                log(state, p.name + ' recovers a chest key.', 'item');
            }
        } else {
            log(state, 'It was only an illusion — no key or chest key is left behind.', 'muted');
        }

        const wasIllusion = b.illusion;
        state.battle = null;
        p.energy = R.startingEnergy;
        if (wasIllusion) advanceTurn(state);
        return ok();
    }

    function losePve(state, p) {
        const b = state.battle;
        const e = D.ENEMIES[b.enemyId];
        log(state, 'The ' + e.name + ' strikes ' + p.name + ' down. Back to the Start.', 'death');
        const wasIllusion = b.illusion;
        state.battle = null;
        sendToStart(state, p, true);
        if (wasIllusion) advanceTurn(state);
        return ok();
    }

    function winPvp(state, winner, loser) {
        const taken = loser.coins;
        winner.coins += taken;
        loser.coins = 0;
        log(state, winner.name + ' defeats ' + loser.name +
                   ' and takes ' + taken + ' coins.', 'system');
        state.battle = null;
        sendToStart(state, loser, true);
        winner.energy = R.startingEnergy;
        // A forced PvP battle ends the mover's turn.
        return advanceTurn(state);
    }

    /* ------------------------------------------------------------------ */
    /* Consumables, abilities, gear                                        */
    /* ------------------------------------------------------------------ */

    function applyEffect(state, p, def) {
        switch (def.effect) {
            case 'energy':
                p.energy += def.value;
                log(state, p.name + ' gains ' + def.value + ' energy.', 'item');
                break;
            case 'damage':
                addBuff(p, 'damage', def.value, 1);
                log(state, p.name + ' will do ' + def.value + ' more damage on their next move.', 'item');
                break;
            case 'defence':
                addBuff(p, 'defence', def.value, 99);   // cleared at end of turn
                log(state, p.name + ' will take ' + def.value + ' less damage this turn.', 'item');
                break;
            case 'dice':
                addBuff(p, 'dice', def.value, 1);
                log(state, p.name + ' adds ' + def.value + ' to their next dice roll.', 'item');
                break;
            case 'health': {
                if (p.hp >= p.maxHp) {
                    p.maxHp += def.value;
                    p.hp += def.value;
                    log(state, p.name + ' raises their maximum health to ' + p.maxHp + '.', 'heal');
                } else {
                    const before = p.hp;
                    p.hp = Math.min(p.maxHp, p.hp + def.value);
                    log(state, p.name + ' heals ' + (p.hp - before) + ' HP.', 'heal');
                }
                break;
            }
        }
    }

    function usePowerup(state, pid, cardUid) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        const inBattle = state.battle &&
            (state.battle.aId === pid || state.battle.bId === pid);
        if (!isMyTurn(state, pid) && !inBattle) return fail('It is not your turn.');

        const idx = p.powerups.findIndex(c => c.uid === cardUid);
        if (idx < 0) return fail('You do not have that card.');
        const card = p.powerups.splice(idx, 1)[0];
        const def = D.POWERUPS[card.id];
        log(state, p.name + ' plays ' + def.name + '.', 'item');
        applyEffect(state, p, def);
        state.decks.powerup.push(card.id);      // used cards go to the bottom of the deck
        return ok();
    }

    function usePotion(state, pid, potionUid) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        const inBattle = state.battle &&
            (state.battle.aId === pid || state.battle.bId === pid);
        if (!isMyTurn(state, pid) && !inBattle) return fail('It is not your turn.');

        const idx = p.potions.findIndex(c => c.uid === potionUid);
        if (idx < 0) return fail('You do not have that potion.');
        const card = p.potions.splice(idx, 1)[0];   // potions are discarded, never resold
        const def = D.POWERUPS[card.id];
        log(state, p.name + ' drinks ' + def.name + '.', 'item');
        applyEffect(state, p, def);
        return ok();
    }

    function eatSteak(state, pid, type) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        const inBattle = state.battle &&
            (state.battle.aId === pid || state.battle.bId === pid);
        if (!isMyTurn(state, pid) && !inBattle) return fail('It is not your turn.');

        if (type === 'cooked') {
            if (p.steaks.cooked < 1) return fail('No seared steak.');
            p.steaks.cooked -= 1;
            const before = p.hp;
            p.hp = Math.min(p.maxHp, p.hp + R.searedSteakHeal);
            log(state, p.name + ' eats a seared steak (+' + (p.hp - before) + ' HP).', 'heal');
        } else {
            if (p.steaks.raw < 1) return fail('No raw steak.');
            p.steaks.raw -= 1;
            const roll = d6();
            if (roll === R.foodPoisoningRoll) {
                p.hp = Math.max(0, p.hp - R.foodPoisoningLoss);
                log(state, p.name + ' rolled a 3 — food poisoning! −' +
                           R.foodPoisoningLoss + ' HP.', 'death');
                if (p.hp <= 0) {
                    if (state.battle) { state.battle = null; }
                    log(state, p.name + ' collapses and returns to the Start.', 'death');
                    sendToStart(state, p, true);
                }
            } else {
                const before = p.hp;
                p.hp = Math.min(p.maxHp, p.hp + R.rawSteakHeal);
                log(state, p.name + ' eats a raw steak (+' + (p.hp - before) + ' HP).', 'heal');
            }
        }
        return ok();
    }

    function cookSteaks(state, pid, count) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        if (!isMyTurn(state, pid)) return fail('It is not your turn.');
        if (!state.pending || state.pending.type !== 'pot' || state.pending.playerId !== pid) {
            return fail('You are not standing at a pot.');
        }
        const n = Math.max(0, Math.min(count, p.steaks.raw));
        p.steaks.raw -= n;
        p.steaks.cooked += n;
        log(state, p.name + ' cooked ' + n + ' steak' + (n === 1 ? '' : 's') + '.', 'item');
        state.pending = null;
        return ok();
    }

    function equip(state, pid, itemUid) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        if (!isMyTurn(state, pid)) return fail('You can only change gear on your turn.');
        if (state.battle) return fail('You cannot change gear during a battle.');
        if (state.turnNo - p.lastEquipTurn < R.equipCooldownTurns) {
            return fail('You may only change weapon or armour every 2 turns.');
        }
        const inst = ownedItem(p, itemUid);
        if (!inst) return fail('You do not have that item.');
        const def = D.ITEMS[inst.id];
        const cls = D.CLASSES[p.cls];

        if (def.kind === 'weapon' && def.subtype !== cls.weaponType) {
            return fail('A ' + cls.name + ' cannot wield that.');
        }
        if (def.kind === 'armour' && def.subtype !== 'any' && def.subtype !== cls.armourType) {
            return fail('That armour is not made for a ' + cls.name + '.');
        }

        if (def.kind === 'weapon') p.weaponUid = inst.uid;
        else p.armourUid = inst.uid;
        p.lastEquipTurn = state.turnNo;
        log(state, p.name + ' equips the ' + def.name + '.', 'item');
        return ok();
    }

    function useAbility(state, pid, payload) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        if (!isMyTurn(state, pid)) return fail('Abilities can only be used on your turn.');
        if (state.turnNo - p.lastAbilityTurn < R.abilityCooldownTurns) {
            return fail('You may only use an ability every 2 turns.');
        }
        const cls = D.CLASSES[p.cls];
        p.lastAbilityTurn = state.turnNo;

        const roll = d6();
        log(state, p.name + ' calls on ' + cls.ability.name + ' and rolled a ' + roll + '.', 'roll');
        if (roll % 2 !== 0) {
            log(state, 'The ability fizzles.', 'muted');
            return ok();
        }

        if (cls.ability.id === 'agile') {
            if (p.hasMoved) return fail('Use Agile before you move.');
            p.agileBonus = 2;
            log(state, p.name + ' is agile — +2 to this movement roll.', 'item');
        } else if (cls.ability.id === 'strength_up') {
            addBuff(p, 'damage', 20, 2);
            log(state, p.name + ' surges with strength — +20 damage for 2 moves.', 'item');
        } else if (cls.ability.id === 'illusion') {
            const targetId = payload && payload.targetPlayerId;
            const enemyId = payload && payload.enemyId;
            const target = player(state, targetId);
            if (!target || target.id === pid) return fail('Choose another player.');
            if (!D.ENEMIES[enemyId] || D.ENEMIES[enemyId].noIllusion) {
                return fail('That enemy cannot be conjured.');
            }
            target.pendingIllusion = enemyId;
            log(state, p.name + ' conjures an illusion of the ' + D.ENEMIES[enemyId].name +
                       ' to ambush ' + target.name + '!', 'system');
        }
        return ok();
    }

    /* ------------------------------------------------------------------ */
    /* Merchant                                                            */
    /* ------------------------------------------------------------------ */

    function buy(state, pid, kind, id) {
        const p = player(state, pid);
        if (!p) return fail('Unknown player.');
        if (!isMyTurn(state, pid)) return fail('You can only trade with the Merchant on your turn.');
        if (state.battle) return fail('The Merchant will not deal during a battle.');
        if (state.pending) return fail('Resolve the square first.');

        if (kind === 'gear') {
            const def = D.ITEMS[id];
            if (!def || !state.merchant.gear[id]) return fail('The Merchant is out of that.');
            if (p.coins < def.price) return fail('You cannot afford that.');
            p.coins -= def.price;
            state.merchant.gear[id] -= 1;
            p.inventory.push({ uid: uid('it'), id: id, uses: def.uses || null });
            log(state, p.name + ' bought the ' + def.name + ' for ' + def.price + ' coins.', 'item');
        } else {
            const price = D.MERCHANT_POTIONS[id] && D.MERCHANT_POTIONS[id].price;
            if (!price || !state.merchant.potions[id]) return fail('The Merchant is out of that.');
            if (p.coins < price) return fail('You cannot afford that.');
            p.coins -= price;
            state.merchant.potions[id] -= 1;
            p.potions.push({ uid: uid('po'), id: id });
            log(state, p.name + ' bought a ' + D.POWERUPS[id].name +
                       ' potion for ' + price + ' coins.', 'item');
        }

        // Buying ends your turn.
        return advanceTurn(state);
    }

    /* ------------------------------------------------------------------ */
    /* Pending square choices                                              */
    /* ------------------------------------------------------------------ */

    function resolvePending(state, pid, choice) {
        const pend = state.pending;
        if (!pend) return fail('Nothing to resolve.');
        if (pend.playerId !== pid) return fail('That choice is not yours to make.');
        const p = player(state, pid);

        switch (pend.type) {
            case 'optional_stop': {
                state.pending = null;
                if (choice === 'stop') {
                    p.movesLeft = 0;
                    return landOn(state, p);
                }
                const left = p.movesLeft;
                p.movesLeft = 0;
                return walk(state, p, left);
            }

            case 'pot':
                state.pending = null;
                return cookSteaksDirect(state, p, choice === undefined ? p.steaks.raw : choice);

            case 'chest':
            case 'crimson_keep': {
                if (pend.options.indexOf(choice) < 0) return fail('That is not on offer.');
                if (pend.type === 'chest') {
                    if (p.chestKeys < 1) return fail('You have no chest key.');
                    p.chestKeys -= 1;
                }
                const def = D.ITEMS[choice];
                const inst = { uid: uid('it'), id: choice, uses: def.uses || null, fromChest: true };
                p.inventory.push(inst);
                log(state, p.name + ' takes the ' + def.name + '!', 'item');
                state.pending = null;
                return ok();
            }

            case 'sea_of_castout': {
                const inst = ownedItem(p, choice);
                if (!inst) return fail('You do not have that item.');
                p.inventory = p.inventory.filter(it => it.uid !== choice);
                if (p.weaponUid === choice) p.weaponUid = null;
                if (p.armourUid === choice) p.armourUid = null;
                log(state, 'The whirlpool swallows ' + p.name + "'s " +
                           D.ITEMS[inst.id].name + '.', 'death');
                state.pending = null;
                return ok();
            }

            case 'pvp_avoid': {
                const other = player(state, pend.otherId);
                state.pending = null;
                if (choice === 'avoid') {
                    log(state, p.name + ' melts into the shadows and avoids the fight.', 'muted');
                    const mover = currentPlayer(state);
                    return resolveSquare(state, mover, square(mover.pos));
                }
                const mover = currentPlayer(state);
                const rival = mover.id === p.id ? other : p;
                return startPvp(state, mover, rival);
            }

            default:
                state.pending = null;
                return ok();
        }
    }

    function cookSteaksDirect(state, p, count) {
        const n = Math.max(0, Math.min(count, p.steaks.raw));
        p.steaks.raw -= n;
        p.steaks.cooked += n;
        if (n) log(state, p.name + ' cooked ' + n + ' steak' + (n === 1 ? '' : 's') + '.', 'item');
        return ok();
    }

    /* ------------------------------------------------------------------ */
    /* Trading                                                             */
    /* ------------------------------------------------------------------ */

    function proposeTrade(state, fromId, toId, give, want) {
        const a = player(state, fromId);
        const b = player(state, toId);
        if (!a || !b) return fail('Unknown player.');
        if (a.id === b.id) return fail('You cannot trade with yourself.');
        if (state.trades.some(t => t.fromId === fromId && t.status === 'open')) {
            return fail('You already have an offer waiting.');
        }
        const t = {
            id: uid('tr'), fromId: fromId, toId: toId,
            give: normaliseBundle(give), want: normaliseBundle(want),
            status: 'open', at: Date.now()
        };
        if (!validateBundle(a, t.give)) return fail('You do not have everything you offered.');
        if (!validateBundle(b, t.want)) return fail(b.name + ' does not have all of that.');
        state.trades.push(t);
        log(state, a.name + ' offers ' + b.name + ' a trade.', 'muted');
        return ok();
    }

    function normaliseBundle(x) {
        x = x || {};
        return {
            coins: Math.max(0, x.coins | 0),
            rawSteaks: Math.max(0, x.rawSteaks | 0),
            cookedSteaks: Math.max(0, x.cookedSteaks | 0),
            keyFragments: Math.max(0, x.keyFragments | 0),
            chestKeys: Math.max(0, x.chestKeys | 0),
            items: (x.items || []).slice(),
            powerups: (x.powerups || []).slice(),
            potions: (x.potions || []).slice()
        };
    }

    function validateBundle(p, bundle) {
        if (p.coins < bundle.coins) return false;
        if (p.steaks.raw < bundle.rawSteaks) return false;
        if (p.steaks.cooked < bundle.cookedSteaks) return false;
        if (p.keyFragments < bundle.keyFragments) return false;
        if (p.chestKeys < bundle.chestKeys) return false;
        if (bundle.items.some(u => !p.inventory.some(i => i.uid === u))) return false;
        if (bundle.powerups.some(u => !p.powerups.some(i => i.uid === u))) return false;
        if (bundle.potions.some(u => !p.potions.some(i => i.uid === u))) return false;
        return true;
    }

    function moveBundle(from, to, bundle) {
        from.coins -= bundle.coins;            to.coins += bundle.coins;
        from.steaks.raw -= bundle.rawSteaks;   to.steaks.raw += bundle.rawSteaks;
        from.steaks.cooked -= bundle.cookedSteaks; to.steaks.cooked += bundle.cookedSteaks;
        from.keyFragments -= bundle.keyFragments;  to.keyFragments += bundle.keyFragments;
        from.chestKeys -= bundle.chestKeys;    to.chestKeys += bundle.chestKeys;

        bundle.items.forEach(u => {
            const i = from.inventory.findIndex(x => x.uid === u);
            if (i >= 0) {
                const inst = from.inventory.splice(i, 1)[0];
                if (from.weaponUid === u) from.weaponUid = null;
                if (from.armourUid === u) from.armourUid = null;
                to.inventory.push(inst);
            }
        });
        bundle.powerups.forEach(u => {
            const i = from.powerups.findIndex(x => x.uid === u);
            if (i >= 0) to.powerups.push(from.powerups.splice(i, 1)[0]);
        });
        bundle.potions.forEach(u => {
            const i = from.potions.findIndex(x => x.uid === u);
            if (i >= 0) to.potions.push(from.potions.splice(i, 1)[0]);
        });
    }

    function respondTrade(state, pid, tradeId, accept) {
        const t = state.trades.find(x => x.id === tradeId);
        if (!t || t.status !== 'open') return fail('That offer is gone.');
        if (t.toId !== pid) return fail('That offer is not for you.');
        const a = player(state, t.fromId);
        const b = player(state, t.toId);

        if (!accept) {
            t.status = 'declined';
            log(state, b.name + ' declined the trade.', 'muted');
            return ok();
        }
        if (!validateBundle(a, t.give) || !validateBundle(b, t.want)) {
            t.status = 'void';
            return fail('The goods have changed — the trade is void.');
        }
        moveBundle(a, b, t.give);
        moveBundle(b, a, t.want);
        t.status = 'accepted';
        log(state, a.name + ' and ' + b.name + ' shook on a trade.', 'system');
        return ok();
    }

    function cancelTrade(state, pid, tradeId) {
        const t = state.trades.find(x => x.id === tradeId);
        if (!t || t.fromId !== pid) return fail('Not your offer.');
        t.status = 'cancelled';
        return ok();
    }

    /* ------------------------------------------------------------------ */

    function ok(data) { return { ok: true, data: data }; }
    function fail(msg) { return { ok: false, error: msg }; }

    global.LOF_ENGINE = {
        makeRoomCode, createGame,
        addPlayer, removePlayer, chooseClass, startGame, rollForOrder,
        currentPlayer, isMyTurn, beginTurn, endTurn, advanceTurn, checkTimeout,
        rollMove, resolvePending,
        battleRoll, battleAttack, availableMoves, battleActorId,
        usePowerup, usePotion, eatSteak, cookSteaks, equip, useAbility, buy,
        proposeTrade, respondTrade, cancelTrade,
        totalDefence, totalAttackBonus, diceModifier,
        equippedWeapon, equippedArmour, player, square, uid, d6
    };

})(typeof window !== 'undefined' ? window : globalThis);
