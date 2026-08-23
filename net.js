/* =========================================================================
   Legend of Fenrirak™, The Thunder Dragon — Online Version
   net.js — Firestore multiplayer.

   One document per room: games/{ROOMCODE}. Every action is applied inside a
   transaction so two players acting at the same instant can never corrupt
   the board.

   Firestore is used ONLY by this page of the website.
   ========================================================================= */

import { initializeApp }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyB-97iZ8wtRynNvr678178hQdEtZSWrwwo",
    authDomain: "lof-thunder-dragon.firebaseapp.com",
    projectId: "lof-thunder-dragon",
    storageBucket: "lof-thunder-dragon.firebasestorage.app",
    messagingSenderId: "468883392504",
    appId: "1:468883392504:web:d6e890328ce97ef6ab380d",
    measurementId: "G-2YELW607YJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const E = window.LOF_ENGINE;

/* ---------------------------------------------------------------------- */
/* Local identity                                                          */
/* ---------------------------------------------------------------------- */

function localId() {
    let id = localStorage.getItem('lof_pid');
    if (!id) {
        id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('lof_pid', id);
    }
    return id;
}

function localName() {
    return localStorage.getItem('lof_name') || '';
}

function setLocalName(n) {
    localStorage.setItem('lof_name', n);
}

const PID = localId();

/* ---------------------------------------------------------------------- */
/* Actions the engine exposes to the network layer                         */
/* ---------------------------------------------------------------------- */

const ACTIONS = {
    chooseClass:   (s, pid, a) => E.chooseClass(s, pid, a.cls),
    startGame:     (s, pid)    => E.startGame(s, pid),
    rollForOrder:  (s, pid)    => E.rollForOrder(s, pid),
    rollMove:      (s, pid)    => E.rollMove(s, pid),
    endTurn:       (s, pid)    => E.endTurn(s, pid),
    battleRoll:    (s, pid)    => E.battleRoll(s, pid),
    battleAttack:  (s, pid, a) => E.battleAttack(s, pid, a.moveId),
    usePowerup:    (s, pid, a) => E.usePowerup(s, pid, a.uid),
    usePotion:     (s, pid, a) => E.usePotion(s, pid, a.uid),
    eatSteak:      (s, pid, a) => E.eatSteak(s, pid, a.type),
    cookSteaks:    (s, pid, a) => E.cookSteaks(s, pid, a.count),
    equip:         (s, pid, a) => E.equip(s, pid, a.uid),
    useAbility:    (s, pid, a) => E.useAbility(s, pid, a),
    buy:           (s, pid, a) => E.buy(s, pid, a.kind, a.id),
    resolvePending:(s, pid, a) => E.resolvePending(s, pid, a.choice),
    proposeTrade:  (s, pid, a) => E.proposeTrade(s, pid, a.toId, a.give, a.want),
    respondTrade:  (s, pid, a) => E.respondTrade(s, pid, a.tradeId, a.accept),
    cancelTrade:   (s, pid, a) => E.cancelTrade(s, pid, a.tradeId),
    leave:         (s, pid)    => E.removePlayer(s, pid),
    rename:        (s, pid, a) => {
        const p = E.player(s, pid);
        if (p) p.name = String(a.name || '').slice(0, 16) || p.name;
        return { ok: true };
    },
    heartbeat:     (s, pid) => {
        const p = E.player(s, pid);
        if (p) { p.lastSeen = Date.now(); p.connected = true; }
        return { ok: true };
    },
    timeoutCheck:  (s) => {
        const changed = E.checkTimeout(s, Date.now());
        return changed ? { ok: true } : { ok: false, error: 'no-timeout', silent: true };
    }
};

/* ---------------------------------------------------------------------- */
/* Room lifecycle                                                          */
/* ---------------------------------------------------------------------- */

function roomRef(code) {
    return doc(db, 'games', code.toUpperCase());
}

// Firestore rejects undefined; strip it before every write.
function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach(k => {
            if (value[k] !== undefined) out[k] = clean(value[k]);
        });
        return out;
    }
    return value === undefined ? null : value;
}

async function createRoom(name) {
    setLocalName(name);
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = E.makeRoomCode();
        const ref = roomRef(code);
        const snap = await getDoc(ref);
        if (snap.exists()) continue;
        const state = E.createGame(code, PID, name);
        await setDoc(ref, clean(state));
        return code;
    }
    throw new Error('Could not find a free room code. Please try again.');
}

async function joinRoom(code, name) {
    setLocalName(name);
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(code)) throw new Error('Room codes are 5 letters, like ABCDE.');

    const ref = roomRef(code);
    const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('No room with the code ' + code + '.');
        const state = snap.data();
        const existing = E.player(state, PID);
        if (existing) {
            existing.name = name || existing.name;
            existing.connected = true;
            existing.lastSeen = Date.now();
        } else {
            const r = E.addPlayer(state, PID, name);
            if (!r.ok) throw new Error(r.error);
        }
        state.updatedAt = Date.now();
        tx.set(ref, clean(state));
        return code;
    });
    return result;
}

async function roomExists(code) {
    const snap = await getDoc(roomRef(code));
    return snap.exists();
}

/* ---------------------------------------------------------------------- */
/* Applying actions                                                        */
/* ---------------------------------------------------------------------- */

async function act(code, action, args) {
    const fn = ACTIONS[action];
    if (!fn) throw new Error('Unknown action: ' + action);
    const ref = roomRef(code);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('This room no longer exists.');
        const state = snap.data();

        const res = fn(state, PID, args || {}) || { ok: true };
        if (!res.ok) {
            const err = new Error(res.error || 'That is not allowed.');
            err.silent = !!res.silent;
            throw err;
        }
        state.updatedAt = Date.now();
        tx.set(ref, clean(state));
        return state;
    });
}

function subscribe(code, onState, onError) {
    return onSnapshot(roomRef(code),
        (snap) => {
            if (!snap.exists()) {
                onError && onError(new Error('The room was closed.'));
                return;
            }
            onState(snap.data());
        },
        (err) => onError && onError(err));
}

async function closeRoom(code) {
    await deleteDoc(roomRef(code));
}

window.LOF_NET = {
    PID, localName, setLocalName,
    createRoom, joinRoom, roomExists, act, subscribe, closeRoom
};
window.dispatchEvent(new Event('lof-net-ready'));
