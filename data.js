/* =========================================================================
   Legend of Fenrirak™, The Thunder Dragon — Online Version
   data.js — all static game content, transcribed from the physical cards.

   Everything in here comes from the photographs in
   "Legend of Fenrirak, The Thunder Dragon/".
   Anything marked PLACEHOLDER or JUDGEMENT is called out in NOTES.md.
   ========================================================================= */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Classes                                                             */
    /* ------------------------------------------------------------------ */

    // art: the character PNGs in this folder are the canonical look.
    const CLASSES = {
        knight: {
            id: 'knight',
            name: 'Knight',
            art: 'Legend of Fenrirak, The Thunder Dragon/Knight.png',
            hp: 100,
            defence: 15,
            weaponType: 'sword',
            armourType: 'knight',
            starterWeapon: 'rusty_claymore',
            starterArmour: 'rusted_armour',
            moves: [
                { id: 'light_swing', name: 'Light Swing', damage: 10, energy: 1 },
                { id: 'heavy_swing', name: 'Heavy Swing', damage: 50, energy: 5 }
            ],
            ability: {
                id: 'strength_up',
                name: 'Strength Up',
                text: 'Roll a die. On an even number, increase your attack by 20 damage for 2 moves.'
            },
            colour: '#b9bec7'
        },
        archer: {
            id: 'archer',
            name: 'Archer',
            art: 'Legend of Fenrirak, The Thunder Dragon/Archer.png',
            hp: 80,
            defence: 10,
            weaponType: 'bow',
            armourType: 'archer',
            starterWeapon: 'damaged_bow',
            starterArmour: 'ripped_chest_plate',
            moves: [
                { id: 'strike', name: 'Strike', damage: 15, energy: 1 },
                { id: 'triple_threat', name: 'Triple Threat', damage: 55, energy: 5 }
            ],
            ability: {
                id: 'agile',
                name: 'Agile',
                text: 'Roll a die. On an even number, add 2 to your movement roll.'
            },
            colour: '#d8a43f'
        },
        mage: {
            id: 'mage',
            name: 'Mage',
            art: 'Legend of Fenrirak, The Thunder Dragon/Mage.png',
            hp: 75,
            defence: 5,
            weaponType: 'magic',
            armourType: 'mage',
            starterWeapon: 'old_training_wand',
            starterArmour: 'old_rag_armour',
            moves: [
                { id: 'orb_of_power', name: 'Orb of Power', damage: 20, energy: 1 },
                { id: 'orb_of_light', name: 'Orb of Light', damage: 60, energy: 5 }
            ],
            ability: {
                id: 'illusion',
                name: 'Illusion',
                text: 'Roll a die. On an even number, conjure an enemy (not Fenrirak or the ' +
                      'Goblin Hideout) and choose another player to fight it. They lose their ' +
                      'turn and receive only the coins.'
            },
            colour: '#5c8fc4'
        }
    };

    const CLASS_ORDER = ['knight', 'archer', 'mage'];

    /* ------------------------------------------------------------------ */
    /* Enemies                                                             */
    /* ------------------------------------------------------------------ */

    const ENEMIES = {
        swarm_of_bats: {
            id: 'swarm_of_bats',
            name: 'Swarm of Bats',
            crest: { initials: 'SB', tint: '#6d5f8c' },
            hp: 60,
            defence: 0,
            placeholder: true,           // PLACEHOLDER — no profile card exists for this fight
            moves: [
                { id: 'bite', name: 'Bite', damage: 20, energy: 1 },
                { id: 'frenzy', name: 'Frenzy', damage: 45, energy: 5 }
            ]
        },
        seraphina: {
            id: 'seraphina',
            name: 'Seraphina',
            crest: { initials: 'S',  tint: '#7a8c4a' },
            hp: 150,
            defence: 0,
            moves: [
                { id: 'poison_fang', name: 'Poison Fang', damage: 40, energy: 1 },
                { id: 'tail_slam', name: 'Tail Slam', damage: 120, energy: 5 }
            ]
        },
        goblin_scout_group: {
            id: 'goblin_scout_group',
            name: 'Goblin Scout Group',
            crest: { initials: 'GS', tint: '#8c6a3a' },
            hp: 100,
            defence: 0,
            moves: [
                { id: 'club_bash', name: 'Club Bash', damage: 40, energy: 1 },
                { id: 'heavy_wack', name: 'Heavy Wack', damage: 60, energy: 5 }
            ]
        },
        goblin_hideout: {
            id: 'goblin_hideout',
            name: 'Goblin Hideout',
            crest: { initials: 'GH', tint: '#8c4a3a' },
            hp: 180,
            defence: 0,
            noIllusion: true,
            moves: [
                { id: 'charge', name: 'Charge', damage: 30, energy: 1 },
                { id: 'all_out_wacks', name: 'All Out Wacks', damage: 120, energy: 5 }
            ]
        },
        fenrirak: {
            id: 'fenrirak',
            name: 'Fenrirak',
            crest: { initials: 'F',  tint: '#4a6a8c', art: 'Fenrirak.png' },
            hp: 275,
            defence: 20,
            boss: true,
            noIllusion: true,
            moves: [
                { id: 'thunder', name: 'Thunder', damage: 75, energy: 1 },
                { id: 'electrocute', name: 'Electrocute', damage: 85, energy: 3 },
                { id: 'discharge', name: 'Discharge', damage: 175, energy: 8 }
            ]
        }
    };

    /* ------------------------------------------------------------------ */
    /* Items — weapons & armour                                            */
    /*                                                                     */
    /* kind:    'weapon' | 'armour'                                        */
    /* subtype: sword | bow | magic          (weapons)                     */
    /*          knight | archer | mage | any (armour)                      */
    /* attack:  added to every attack that deals damage                    */
    /* defence: subtracted from every hit taken                            */
    /* dice:    added to dice rolls                                        */
    /* uses:    durability; omitted = unbreakable                          */
    /* ------------------------------------------------------------------ */

    const ITEMS = {
        /* --- starting gear (3 uses each) ------------------------------- */
        rusty_claymore: {
            id: 'rusty_claymore', name: 'Rusty Claymore', kind: 'weapon', subtype: 'sword',
            attack: 5, uses: 3, starter: true,
            text: 'Do 5 more damage. Breaks after 3 uses.'
        },
        damaged_bow: {
            id: 'damaged_bow', name: 'Damaged Bow', kind: 'weapon', subtype: 'bow',
            attack: 5, uses: 3, starter: true,
            text: 'Do 5 more damage. Breaks after 3 uses.'
        },
        old_training_wand: {
            id: 'old_training_wand', name: 'Old Training Wand', kind: 'weapon', subtype: 'magic',
            attack: 5, uses: 3, starter: true,
            text: 'Do 5 more damage. Breaks after 3 uses.'
        },
        rusted_armour: {
            id: 'rusted_armour', name: 'Rusted Armour', kind: 'armour', subtype: 'knight',
            defence: 5, uses: 3, starter: true,
            text: 'Take 5 less damage. Breaks after 3 hits.'
        },
        old_rag_armour: {
            id: 'old_rag_armour', name: 'Old Rag Armour', kind: 'armour', subtype: 'mage',
            defence: 5, uses: 3, starter: true,
            text: 'Take 5 less damage. Breaks after 3 hits.'
        },
        ripped_chest_plate: {
            id: 'ripped_chest_plate', name: 'Ripped Chest Plate', kind: 'armour', subtype: 'archer',
            defence: 5, uses: 3, starter: true,
            text: 'Take 5 less damage. Breaks after 3 hits.'
        },

        /* --- Knight: swords -------------------------------------------- */
        dagger: {
            id: 'dagger', name: 'Dagger', kind: 'weapon', subtype: 'sword',
            attack: 5, text: 'Do 5 more damage.'
        },
        broadsword: {
            id: 'broadsword', name: 'Broadsword', kind: 'weapon', subtype: 'sword',
            attack: 10, text: 'Do 10 more damage.'
        },
        strong_broadsword: {
            id: 'strong_broadsword', name: 'Strong Broadsword', kind: 'weapon', subtype: 'sword',
            attack: 15, text: 'Do 15 more damage.'
        },
        claymore: {
            id: 'claymore', name: 'Claymore', kind: 'weapon', subtype: 'sword',
            attack: 20, text: 'Do 20 more damage.'
        },

        /* --- Knight: armour -------------------------------------------- */
        full_body_armour: {
            id: 'full_body_armour', name: 'Full Body Armour', kind: 'armour', subtype: 'knight',
            defence: 10, text: 'Take 10 less damage.'
        },
        heavy_armour: {
            id: 'heavy_armour', name: 'Heavy Armour', kind: 'armour', subtype: 'knight',
            defence: 20, dice: -1,
            text: 'Take 20 less damage, but every dice roll is reduced by 1.'
        },
        royal_guards_uniform: {
            id: 'royal_guards_uniform', name: "Royal Guard's Uniform", kind: 'armour', subtype: 'knight',
            defence: 30, attack: 5,
            text: 'Take 30 less damage and do 5 more damage.'
        },

        /* --- Archer: bows ---------------------------------------------- */
        cool_bow: {
            id: 'cool_bow', name: 'Cool Bow', kind: 'weapon', subtype: 'bow',
            attack: 5, text: 'Do 5 more damage.'
        },
        light_bow: {
            id: 'light_bow', name: 'Light Bow', kind: 'weapon', subtype: 'bow',
            attack: 10, text: 'Do 10 more damage.'
        },
        normal_bow: {
            id: 'normal_bow', name: 'Normal Bow', kind: 'weapon', subtype: 'bow',
            attack: 15, text: 'Do 15 more damage.'
        },
        explosive_bow: {
            id: 'explosive_bow', name: 'Explosive Bow', kind: 'weapon', subtype: 'bow',
            attack: 20, text: 'Does 20 more damage.'
        },

        /* --- Archer: armour -------------------------------------------- */
        light_armour: {
            id: 'light_armour', name: 'Light Armour', kind: 'armour', subtype: 'archer',
            defence: 5, dice: 1,
            text: 'Take 5 less damage and add 1 to your dice roll.'
        },
        plated_light_armour: {
            id: 'plated_light_armour', name: 'Plated Light Armour', kind: 'armour', subtype: 'archer',
            defence: 10, dice: 1,
            text: 'Take 10 less damage and add 1 to your dice roll.'
        },
        royal_archers_suit: {
            id: 'royal_archers_suit', name: "Royal Archer's Suit", kind: 'armour', subtype: 'archer',
            defence: 25, dice: 1,
            text: 'Take 25 less damage and add 1 to your dice roll.'
        },

        /* --- Mage: magic ----------------------------------------------- */
        magic_staff: {
            id: 'magic_staff', name: 'Magic Staff', kind: 'weapon', subtype: 'magic',
            attack: 10, text: 'Do 10 more damage.'
        },
        star_wand: {
            id: 'star_wand', name: 'Star Wand', kind: 'weapon', subtype: 'magic',
            attack: 15, text: 'Do 15 more damage.'
        },
        crystal_staff: {
            id: 'crystal_staff', name: 'Crystal Staff', kind: 'weapon', subtype: 'magic',
            attack: 20, text: 'Do 20 more damage.'
        },
        lunar_staff: {
            id: 'lunar_staff', name: 'Lunar Staff', kind: 'weapon', subtype: 'magic',
            attack: 25, text: 'Do 25 more damage.'
        },

        /* --- Mage: armour ---------------------------------------------- */
        light_cloak: {
            id: 'light_cloak', name: 'Light Cloak', kind: 'armour', subtype: 'mage',
            defence: 10, text: 'Take 10 less damage.'
        },
        light_cloak_swift: {
            id: 'light_cloak_swift', name: 'Light Cloak', kind: 'armour', subtype: 'mage',
            defence: 10, dice: 1,
            text: 'Take 10 less damage. Add one to your dice roll.'
        },
        royal_mages_robe: {
            id: 'royal_mages_robe', name: "Royal Mage's Robe", kind: 'armour', subtype: 'mage',
            defence: 10, attack: 10,
            text: 'Take 10 less damage and do 10 more damage.'
        },
        mystical_robe: {
            id: 'mystical_robe', name: 'Mystical Robe', kind: 'armour', subtype: 'mage',
            defence: 15, attack: 15,
            text: 'Take 15 less damage and do 15 more damage.'
        },

        /* --- Merchant stock -------------------------------------------- */
        spiked_bat: {
            id: 'spiked_bat', name: 'Spiked Bat', kind: 'weapon', subtype: 'sword',
            attack: 10, price: 5, text: 'Do 10 more damage.'
        },
        spear: {
            id: 'spear', name: 'Spear', kind: 'weapon', subtype: 'sword',
            attack: 20, price: 8, text: 'Do 20 more damage.'
        },
        iron_claymore: {
            id: 'iron_claymore', name: 'Iron Claymore', kind: 'weapon', subtype: 'sword',
            attack: 25, price: 15, text: 'Do 25 more damage.'
        },
        quick_bow: {
            id: 'quick_bow', name: 'Quick Bow', kind: 'weapon', subtype: 'bow',
            attack: 10, price: 5, text: 'Do 10 more damage.'
        },
        cross_fire_bow: {
            id: 'cross_fire_bow', name: 'Cross Fire Bow', kind: 'weapon', subtype: 'bow',
            attack: 15, price: 8, text: 'Do 15 more damage.'
        },
        falcon_bow: {
            id: 'falcon_bow', name: 'Falcon Bow', kind: 'weapon', subtype: 'bow',
            attack: 30, price: 15, text: 'Do 30 more damage.'
        },
        star_tipped_wand: {
            id: 'star_tipped_wand', name: 'Star Tipped Wand', kind: 'weapon', subtype: 'magic',
            attack: 10, price: 5, text: 'Do 10 more damage.'
        },
        shining_staff: {
            id: 'shining_staff', name: 'Shining Staff', kind: 'weapon', subtype: 'magic',
            attack: 15, price: 10, text: 'Do 15 more damage.'
        },
        wand_of_power: {
            id: 'wand_of_power', name: 'Wand of Power', kind: 'weapon', subtype: 'magic',
            attack: 30, price: 15, text: 'Do 30 more damage.'
        },
        reinforced_light_armour: {
            id: 'reinforced_light_armour', name: 'Reinforced Light Armour',
            kind: 'armour', subtype: 'any',
            defence: 15, dice: 1, price: 12,
            text: 'Take 15 less damage and add 1 to your dice roll.'
        },
        iron_armour: {
            id: 'iron_armour', name: 'Iron Armour', kind: 'armour', subtype: 'any',
            defence: 20, price: 15, text: 'Take 20 less damage.'
        },
        spiked_armour: {
            id: 'spiked_armour', name: 'Spiked Armour', kind: 'armour', subtype: 'any',
            defence: 10, attack: 5, price: 85,
            text: 'Take 10 less damage and do 5 more damage.'
        },

        /* --- Crimson Keep / Chest treasure ------------------------------ */
        cloak_of_invisibility: {
            id: 'cloak_of_invisibility', name: 'Cloak of Invisibility',
            kind: 'armour', subtype: 'any', treasure: true,
            defence: 20, avoidPvp: true,
            text: 'Take 20 less damage. You may choose to avoid PvP battles.'
        },
        dark_iron_armour: {
            id: 'dark_iron_armour', name: 'Dark Iron Armour',
            kind: 'armour', subtype: 'any', treasure: true,
            defence: 30, firstStrikePvp: true,
            text: 'Take 30 less damage. You will always attack first in a PvP battle.'
        },
        dragon_scale_armour: {
            id: 'dragon_scale_armour', name: 'Dragon Scale Armour',
            kind: 'armour', subtype: 'any', treasure: true,
            defence: 35, fenrirakMovesPvp: true,
            text: 'Take 35 less damage. You may use one of Fenrirak’s attacks in a PvP ' +
                  'battle (requires the same amount of energy as Fenrirak).'
        },
        great_bulging_broadsword: {
            id: 'great_bulging_broadsword', name: 'Great Bulging Broadsword',
            kind: 'weapon', subtype: 'sword', treasure: true,
            attack: 30, text: 'Do 30 more damage.'
        },
        compound_bow: {
            id: 'compound_bow', name: 'Compound Bow',
            kind: 'weapon', subtype: 'bow', treasure: true,
            attack: 40, text: 'Do 40 more damage.'
        },
        staff_of_life: {
            id: 'staff_of_life', name: 'Staff of Life',
            kind: 'weapon', subtype: 'magic', treasure: true,
            attack: 45, healPerMove: 5,
            text: 'Do 45 more damage and with every move heal 5 HP.'
        }
    };

    // The six treasures behind a Chest square / the Crimson Keep.
    const TREASURE_POOL = [
        'cloak_of_invisibility', 'dark_iron_armour', 'dragon_scale_armour',
        'great_bulging_broadsword', 'compound_bow', 'staff_of_life'
    ];

    /* ------------------------------------------------------------------ */
    /* Item deck — the yellow class cards, in the quantities photographed  */
    /* ------------------------------------------------------------------ */

    const ITEM_DECK = [
        // swords
        'dagger', 'dagger', 'broadsword', 'strong_broadsword', 'claymore',
        // knight armour
        'full_body_armour', 'full_body_armour', 'full_body_armour',
        'heavy_armour', 'heavy_armour', 'royal_guards_uniform',
        // bows
        'cool_bow', 'light_bow', 'normal_bow', 'normal_bow', 'explosive_bow',
        // archer armour
        'light_armour', 'light_armour', 'light_armour',
        'plated_light_armour', 'plated_light_armour', 'royal_archers_suit',
        // magic
        'magic_staff', 'magic_staff', 'star_wand', 'crystal_staff', 'lunar_staff',
        // mage armour
        'light_cloak', 'light_cloak_swift', 'light_cloak_swift',
        'royal_mages_robe', 'royal_mages_robe', 'mystical_robe'
    ];

    /* ------------------------------------------------------------------ */
    /* Power-up deck                                                       */
    /* effect kinds: energy | damage | health | dice | defence            */
    /* ------------------------------------------------------------------ */

    const POWERUPS = {
        low_energy_up:      { id: 'low_energy_up',      name: 'Low Energy Up',      effect: 'energy',  value: 2,  text: 'Add 2 energy to your character.' },
        energy_up:          { id: 'energy_up',          name: 'Energy Up',          effect: 'energy',  value: 4,  text: 'Add 4 energy to your character.' },
        low_strength_up:    { id: 'low_strength_up',    name: 'Low Strength Up',    effect: 'damage',  value: 10, text: 'Do 10 more damage.' },
        strength_up:        { id: 'strength_up',        name: 'Strength Up',        effect: 'damage',  value: 20, text: 'Do 20 more damage.' },
        super_strength_up:  { id: 'super_strength_up',  name: 'Super Strength Up',  effect: 'damage',  value: 30, text: 'Do 30 more damage.' },
        low_health_up:      { id: 'low_health_up',      name: 'Low Health Up',      effect: 'health',  value: 15, text: 'Add 15 health to your character.' },
        health_up:          { id: 'health_up',          name: 'Health Up',          effect: 'health',  value: 25, text: 'Add 25 health to your character.' },
        super_health_up:    { id: 'super_health_up',    name: 'Super Health Up',    effect: 'health',  value: 50, text: 'Add 50 health to your character.' },
        low_speed_up:       { id: 'low_speed_up',       name: 'Low Speed Up',       effect: 'dice',    value: 1,  text: 'Add 1 to your dice roll.' },
        speed_up:           { id: 'speed_up',           name: 'Speed Up',           effect: 'dice',    value: 3,  text: 'Add 3 to your dice roll.' },
        low_defence_up:     { id: 'low_defence_up',     name: 'Low Defence Up',     effect: 'defence', value: 5,  text: 'Take 5 less damage.' },
        defence_up:         { id: 'defence_up',         name: 'Defence Up',         effect: 'defence', value: 10, text: 'Take 10 less damage.' }
    };

    // Super Strength Up appears twice in the photographed deck.
    const POWERUP_DECK = [
        'low_energy_up', 'energy_up',
        'low_strength_up', 'strength_up', 'super_strength_up', 'super_strength_up',
        'low_health_up', 'health_up', 'super_health_up',
        'low_speed_up', 'speed_up',
        'low_defence_up', 'defence_up'
    ];

    /* ------------------------------------------------------------------ */
    /* Merchant                                                            */
    /* Weapons and armour: 1 of each. Potions: stock as written on the      */
    /* pricing sheets ("x3", "x5").                                        */
    /* ------------------------------------------------------------------ */

    const MERCHANT_POTIONS = {
        energy_up:         { price: 15, stock: 3 },
        low_energy_up:     { price: 12, stock: 5 },
        health_up:         { price: 8,  stock: 3 },
        super_health_up:   { price: 12, stock: 3 },
        low_strength_up:   { price: 9,  stock: 5 },
        strength_up:       { price: 15, stock: 3 },
        super_strength_up: { price: 25, stock: 3 },
        low_defence_up:    { price: 8,  stock: 3 },
        defence_up:        { price: 15, stock: 3 },
        low_speed_up:      { price: 5,  stock: 3 },
        speed_up:          { price: 8,  stock: 3 },
        low_health_up:     { price: 6,  stock: 3 }
    };

    const MERCHANT_GEAR = [
        'spiked_bat', 'spear', 'iron_claymore',
        'quick_bow', 'cross_fire_bow', 'falcon_bow',
        'star_tipped_wand', 'shining_staff', 'wand_of_power',
        'reinforced_light_armour', 'iron_armour', 'spiked_armour'
    ];

    /* ------------------------------------------------------------------ */
    /* The board                                                           */
    /*                                                                     */
    /* A linear race track: START (0) through to Fenrirak's Arena (22).     */
    /* row/col place each square on a 7x5 grid matching the handmade board; */
    /* the arena occupies the centre.                                      */
    /* ------------------------------------------------------------------ */

    const BOARD = [
        { i: 0,  key: 'start',            name: 'Start',                row: 4, col: 6,
          text: 'Every journey begins here.' },

        { i: 1,  key: 'draw_powerup',     name: 'Draw 3 Power-Ups',     row: 4, col: 5,
          action: 'draw_powerup', count: 3, text: 'Draw 3 power-up cards.' },

        { i: 2,  key: 'draw_item',        name: 'Draw 2 Item Cards',    row: 4, col: 4,
          action: 'draw_item', count: 2, text: 'Draw 2 item cards.' },

        { i: 3,  key: 'draw_item',        name: 'Draw 1 Item Card',     row: 4, col: 3,
          action: 'draw_item', count: 1, scenery: 'bridge',
          text: 'The bridge over the Sea of Castout. Draw 1 item card.' },

        { i: 4,  key: 'draw_powerup',     name: 'Draw 2 Power-Ups',     row: 4, col: 2,
          action: 'draw_powerup', count: 2, text: 'Draw 2 power-up cards.' },

        { i: 5,  key: 'draw_item_key',    name: 'Item Card + Chest Key', row: 4, col: 1,
          action: 'draw_item_key', count: 1, text: 'Draw 1 item card and get a chest key.' },

        { i: 6,  key: 'draw_item',        name: 'Draw 2 Item Cards',    row: 4, col: 0,
          action: 'draw_item', count: 2, text: 'Draw 2 item cards.' },

        { i: 7,  key: 'spring',           name: 'Spring',               row: 3, col: 0,
          action: 'spring', value: 2, text: 'Move forward two spaces.' },

        { i: 8,  key: 'castle_ruins',     name: 'Castle Ruins',         row: 2, col: 0,
          action: 'battle', enemy: 'swarm_of_bats', coins: 3, chestKey: 1, stop: true,
          text: 'You have to fight a swarm of bats. Finds 3 coins and a chest key.' },

        { i: 9,  key: 'sack_of_gold',     name: 'Sack of Gold',         row: 1, col: 0,
          action: 'coins', coins: 10, text: 'Congrats! You found a sack of gold! +10 coins.' },

        { i: 10, key: 'pot',              name: 'Pot',                  row: 0, col: 0,
          action: 'pot', text: 'You may cook steak!' },

        { i: 11, key: 'midnight_desert',  name: 'Midnight Desert',      row: 0, col: 1,
          action: 'battle', enemy: 'seraphina', coins: 8, keyFragment: 1, stop: true,
          text: 'You have to fight Seraphina. Drops 8 coins and a key fragment.' },

        { i: 12, key: 'chest',            name: 'Chest',                row: 0, col: 2,
          action: 'chest', text: 'Get an armour set or special weapon. (Cost: 1 chest key)' },

        { i: 13, key: 'sea_of_castout',   name: 'Sea of Castout',       row: 0, col: 3,
          action: 'sea_of_castout', stop: true, scenery: 'water',
          text: 'A whirlpool takes one of your items. Choose something to lose. STOP.' },

        { i: 14, key: 'slivergrove',      name: 'Slivergrove Village',  row: 0, col: 4,
          action: 'heal', value: 50, text: 'Heal 50 HP.' },

        { i: 15, key: 'uncharted_forest', name: 'Uncharted Forest',     row: 0, col: 5,
          action: 'battle', enemy: 'goblin_scout_group', coins: 5, keyFragment: 1, stop: true,
          text: 'You have to fight a goblin scout group. Drops 5 coins and a key fragment.' },

        { i: 16, key: 'crimson_keep',     name: 'Crimson Keep',         row: 0, col: 6,
          action: 'crimson_keep', stop: true,
          text: 'CHOOSE 1 — sword, armour, bow or wand that suits your class.' },

        { i: 17, key: 'chest',            name: 'Chest',                row: 1, col: 6,
          action: 'chest', text: 'Get an armour set or special weapon. (Cost: 1 chest key)' },

        { i: 18, key: 'pot',              name: 'Pot',                  row: 2, col: 6,
          action: 'pot', text: 'You may cook steak!' },

        { i: 19, key: 'goblin_hideout',   name: 'Goblin Hideout',       row: 3, col: 6,
          action: 'battle', enemy: 'goblin_hideout', coins: 15, keyFragment: 1, stop: true,
          text: 'You stumble across a goblin hideout. You fight the goblins! ' +
                'Drops 15 coins and a key fragment.' },

        { i: 20, key: 'fountain_of_life', name: 'Fountain of Life',     row: 3, col: 5,
          action: 'heal', value: 100, optionalStop: true,
          text: 'Heal 100 HP. Optional stop.' },

        { i: 21, key: 'gate',             name: 'The Gate',             row: 2, col: 5,
          action: 'gate', stop: true,
          text: 'Three different key fragments open the way. Without them, you are cast ' +
                'back to the Start.' },

        { i: 22, key: 'arena',            name: "Fenrirak's Arena",     row: 1, col: 1,
          rowSpan: 3, colSpan: 4,
          action: 'battle', enemy: 'fenrirak', stop: true, arena: true,
          text: 'The Thunder Dragon waits. Defeat Fenrirak and the legend is yours.' }
    ];


    // Scenery, not a square you can land on — fills the gap beside the arena.
    const DECOR = [
        { row: 1, col: 5, name: 'The Iconic Tree', art: 'Tree.png' }
    ];

    const START_INDEX = 0;
    const ARENA_INDEX = 22;
    const KEY_FRAGMENTS_NEEDED = 3;

    /* ------------------------------------------------------------------ */

    const RULES = {
        minPlayers: 2,
        maxPlayers: 6,
        maxPerClass: 2,
        turnTimeoutMs: 60000,          // auto-skip after 1 minute of inactivity
        startingCoins: 0,
        equipCooldownTurns: 2,         // change weapon/armour every 2 turns
        abilityCooldownTurns: 2,       // one ability every 2 turns
        startingEnergy: 1,
        rawSteakHeal: 5,
        searedSteakHeal: 10,
        foodPoisoningLoss: 15,
        foodPoisoningRoll: 3,
        steakRolls: [2, 4, 6]
    };

    global.LOF_DATA = {
        CLASSES, CLASS_ORDER, ENEMIES, ITEMS, TREASURE_POOL,
        ITEM_DECK, POWERUPS, POWERUP_DECK,
        MERCHANT_POTIONS, MERCHANT_GEAR,
        BOARD, DECOR, START_INDEX, ARENA_INDEX, KEY_FRAGMENTS_NEEDED, RULES
    };

})(typeof window !== 'undefined' ? window : globalThis);
