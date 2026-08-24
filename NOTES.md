# Transcription notes & judgement calls

Everything in `data.js` comes from the card photographs. This file lists the
places where the photo was ambiguous, contradictory, or silent — and what was
done about it. Change any of these in `data.js` and the game picks it up
immediately; nothing else needs editing.

---

## Decided by you

| Thing | Decision |
|---|---|
| Fenrirak's health | **275** |
| Fenrirak's Discharge | **175 damage, 8 energy** |
| Swarm of Bats | Placeholder stats (see below) |
| The Gate & Arena | Added after the Fountain of Life; the arena is the centre of the board |
| Starter armour | Rusted Armour → Knight, Old Rag Armour → Mage, Ripped Chest Plate → Archer |
| Reinforced Light Armour price | **$12** |
| Iron Armour at $15 for 20 defence | Intentional — left as written |
| Merchant sheet "Defence" numbers | Ignored; the item cards are the source of truth |
| Defence | Reduces damage taken. Class defence **+** armour **+** any defence buffs |
| Duplicate cards | Intentional — kept at the photographed quantities |
| Broadsword's faint second line | Ignored |
| Starter weapon and armour durability | 3 uses each (all six starter pieces) |
| Crimson Keep | Pick any treasure that suits your class |
| Fenrirak's health between attempts | Resets to full after every battle |
| Merchant stock | Items without an "xN" on the sheet have exactly 1 in stock |

---

## Placeholder — needs your numbers

**Swarm of Bats** (Castle Ruins). There is no profile card for this fight, so it
currently uses:

```
Health 60, Defence 0
Bite    — 20 damage (1 energy)
Frenzy  — 45 damage (5 energy)
```

It is the first fight on the track, so it is pitched below the Goblin Scout
Group. Replace the numbers in `data.js` under `swarm_of_bats` whenever you make
the real card.

---

## Judgement calls I made

**Rusty Claymore attack bonus — set to +5.**
The card reads "Do 2̶5̶ more damage but you can only use this weapon 3 times
before it breaks", with the number written over itself. The other two starter
weapons (Old Training Wand, Damaged Bow) are both +5, and +25 would make the
Knight's starting kit stronger than most mid-game swords. If you meant +25,
change `attack: 5` to `attack: 25` on `rusty_claymore`.

**Energy is a requirement, not a cost.**
The rulebook says twice that "the energy doesn't get depleted when you use a
move" and that you gain 1 energy per attack — but the turn-sequence list also
says "apply energy cost". The game follows the rulebook text: you start a battle
on 1 energy, gain 1 each time you attack, and never spend any. Energy resets to 1
when the battle ends. This is why Heavy Swing (5 energy) becomes available on
your fifth attack.

**How long buffs last.**
"Each power-up only lasts for one move or one turn." Implemented as:
- Damage buffs → your next attack that deals damage.
- Dice buffs → your next roll.
- Defence buffs → until the end of your turn.
- Energy and health → applied immediately.
The Knight's Strength Up explicitly lasts 2 moves, and does.

**Merchant armour is universal.**
Reinforced Light Armour, Iron Armour and Spiked Armour have generic names and no
class on the card, so any class can wear them — same as chest armour.

**Chest vs. Crimson Keep.**
Both draw from the same six treasures. A **Chest** costs a chest key and is
unrestricted ("any character type is allowed to use any of the armour sets in the
chest"). The **Crimson Keep** is free but filtered to what your class can use.

**The Merchant is always available on your turn.**
The board has the Merchant standing beside the track rather than on a square, and
the rules say you may buy "when it is your turn" and that buying ends your turn.
So it's a turn action you can take instead of moving, not a square you land on.

**Stop squares stop you as you pass them,** not only when you land on them —
otherwise the word "STOP" would do nothing. Optional stops prompt you to choose.

**The board is a race, not a loop.**
The physical board reads as a ring, but the rules describe reaching the Gate and
the arena, so it's laid out as a track: Start → 20 squares → Fountain of Life →
Gate → Arena. Dying sends you back to Start with full health and all your things.

**The human Monster Controller role is gone.**
Your notes say monsters and the Merchant are computer-run, so there is no
"monster controller" seat online — everyone plays a character and the computer
narrates and fights. The narrator log on the right is that role.

**Lux Aurea → Crimson Keep** everywhere, as instructed.

---

## Behaviour you might otherwise wonder about

**Dice modifiers only affect movement.** Light Armour says "add 1 to your dice
roll" and Heavy Armour says "every dice you roll gets subtracted by 1". Taken
literally that would also apply to the even/odd roll in battle — where +1 flips
every hit into a miss and every miss into a hit, which cannot be the intent. So
those modifiers apply to movement rolls only. Battle, steak and ability rolls are
always a plain die.

**Durability counts hits, not damage.** A starter weapon loses a use on any
attack that connects, even one blocked down to 0 damage, and starter armour loses
a use on any hit it takes, even one it fully absorbs. Three uses is three uses.

**When your starter weapon breaks you may have nothing to replace it with.** Your
attack bonus drops to +0 until you draw or buy a weapon. The character panel shows
"Weapon: none" — that is real, not a display bug, and it matters: simulated
players who never re-equip essentially cannot beat the Goblin Hideout.

**Two different cards are both called "Light Cloak".** One is "take 10 less
damage", the other adds 1 to your dice roll as well. That is what the photographs
show, so both keep the name; their card text tells them apart.

## Things worth watching in play

- **Iron Armour at $15 for 20 defence** is by far the best value in the shop;
  Spiked Armour at $85 for 10 defence and +5 attack will almost never be bought.
  You said this is deliberate, so it is left alone.
- **Fenrirak resets to full each attempt**, so the first player through the Gate
  with strong gear tends to win outright. In 40 simulated 3-player games the
  average game ran about 110 turns.
- **Dragon Scale Armour** lets you use Fenrirak's attacks in PvP, including
  Discharge at 175 damage — that will one-shot anyone who has it available.
