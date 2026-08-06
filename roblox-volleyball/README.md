# Roblox Volleyball 🏐

Step 1 of building a Roblox volleyball game: a **flat map with a volleyball
court painted in the middle** — no net yet.

## What's here

- **`CourtBuilder.server.lua`** — a Luau script that builds the whole map for
  you automatically when you press Play. No modeling by hand required.

## How to use it (when you're back at your laptop)

1. Open **Roblox Studio** → **New** → **Baseplate**.
2. In the **Explorer** panel (View → Explorer if you don't see it), find
   **ServerScriptService**.
3. Right-click **ServerScriptService** → **Insert Object** → **Script**.
4. Delete the sample code inside that new Script.
5. Open `CourtBuilder.server.lua`, copy everything, and paste it in.
6. Press **Play** (▶). The field and court appear instantly.

Everything is grouped under a Model named **`VolleyballMap`** in the Workspace,
so it's easy to find, move, or delete.

## What gets built

- A large flat grass field (400 × 400 studs) with a spawn point.
- A sand court in the middle, sized **108 × 54 studs** (a regulation **2:1**
  ratio — real courts are 18m × 9m).
- White painted lines: the outer boundary, the **center line**, and the two
  **attack lines** (3m from center).
- **No net** — that's the next step.

## Tweaking it

Near the top of the script there's a **CONFIG** section. Change the numbers to
resize the court or field, or the **COLORS** to recolor the sand, grass, and
lines. Re-run and it rebuilds cleanly (old copy is removed automatically).

## Next steps (ideas for later)

- Add the net across the center line.
- Add a volleyball you can hit.
- Add scoring and two team zones.
