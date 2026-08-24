# The Thunder Dragon — Online Version

Everything for the online game lives in two places:

| File | What it is |
|---|---|
| `Thunder Dragon.html` | The page itself (linked from the site's nav bar and the home page) |
| `game/data.js` | All the cards, items, enemies, prices and board squares |
| `game/engine.js` | The rules — movement, battles, trading, the Merchant |
| `game/ui.js` | Everything you see and click |
| `game/net.js` | Firestore multiplayer (the only file that talks to Firebase) |
| `game/style.css` | Styling |

---

## 1. Turn on Firestore (you must do this once)

The page is already wired to your `lof-thunder-dragon` project. Right now every
request is rejected with **"Missing or insufficient permissions"** because the
database has no rules published yet.

1. Go to <https://console.firebase.google.com/project/lof-thunder-dragon/firestore>
2. If you have never opened Firestore, click **Create database**. Pick a location
   close to you (e.g. `australia-southeast1`) and choose **Start in production mode**
   — the rules below replace whatever it starts with.
3. Open the **Rules** tab, delete what is there, and paste this in:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // The Thunder Dragon online game — this collection only.
    match /games/{code} {
      allow read: if true;

      allow create, update: if
        code.matches('^[A-Z]{5}$')
        && request.resource.data.keys().hasAll(['code', 'phase', 'players'])
        && request.resource.data.players.size() <= 6
        && request.resource.data.code == code;

      allow delete: if false;
    }

    // Nothing else in the project is readable or writable.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**.

That is the whole setup. Reload `Thunder Dragon.html` and **Create a new room**
will work.

### What those rules do

- Only the `games` collection is touched — **no other part of your Firebase
  project is exposed**, which is what you asked for.
- Room documents must be named with 5 capital letters, must look like a real game
  document, and can never hold more than 6 players.
- Nobody can delete a room, so a game can't be wiped mid-play.

### Optional: clean up old rooms automatically

Rooms are small (a few KB each) but they pile up. In the Firestore console go to
**Firestore → TTL**, add a policy on collection `games` using the field
`updatedAt`, and set it to, say, 2 days. (Firestore's TTL wants a real timestamp
field; if you want this, tell me and I'll switch `updatedAt` from a millisecond
number to a Firestore `Timestamp`.)

---

## 2. Publishing

The page is plain HTML and JavaScript — it works anywhere the rest of the site
works, including GitHub Pages. Two things to remember:

- `game/net.js` is an **ES module**, so the page must be opened over `http://`
  or `https://`, not by double-clicking the file. Opening it from disk will
  silently fail to load the multiplayer code.
- Add your live domain under **Firebase Console → Authentication → Settings →
  Authorised domains** if you ever add sign-in. (Not needed for Firestore alone.)

To test locally, run this in the website folder and open
<http://127.0.0.1:8731/Thunder%20Dragon.html>:

```bash
python -m http.server 8731 --bind 127.0.0.1
```

---

## 3. How a game runs

1. One player enters a name and clicks **Create a new room**. They get a 5-letter
   code and an invite link (`Thunder Dragon.html?room=ABCDE`).
2. Everyone else joins with the code or the link. 2–6 players, at most two of
   each class.
3. The host starts the game. Everyone rolls for turn order; ties reroll.
4. On your turn you may use your ability, play power-up cards, drink potions, eat
   steak, propose trades, and then either **roll and move** or **visit the
   Merchant** (buying ends your turn).
5. Monsters are run by the computer. They roll to hit exactly like players and
   always use the highest-damage attack they have the energy for.
6. If you sit idle for more than a minute on your turn, it is skipped.

Your identity is stored in your browser (`localStorage`), so refreshing the page
or closing the tab and coming back puts you straight back into your game.

---

## 4. Where the numbers came from

Every stat, price and card effect in `game/data.js` was transcribed from the
photographs in `Legend of Fenrirak, The Thunder Dragon/`. See `NOTES.md` in this
folder for the handful of places where a card was ambiguous and a judgement call
was made.
