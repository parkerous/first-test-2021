--[[
	CourtBuilder — Volleyball Map Generator
	=======================================

	Builds a flat playing field with a regulation-proportioned volleyball
	court painted in the middle. NO NET yet (added in a later step).

	HOW TO USE THIS IN ROBLOX STUDIO
	--------------------------------
	1. Open Roblox Studio and create a new "Baseplate" (or empty) place.
	2. In the Explorer panel, find "ServerScriptService".
	3. Right-click it -> Insert Object -> Script.
	4. Delete the default code in that Script.
	5. Open this file, copy ALL of it, and paste it into that Script.
	6. Press Play. The field and court are built automatically.

	Everything is grouped under a Model called "VolleyballMap" in the
	Workspace, so you can find, move, or delete it easily.

	A regulation court is 18m long x 9m wide (a 2:1 rectangle). We keep
	that ratio but scale it up so Roblox characters have room to move.
--]]

-- SERVICES ------------------------------------------------------------------
local Workspace = game:GetService("Workspace")

-- CONFIG (tweak these numbers to resize things) -----------------------------
local COURT_LENGTH = 108    -- studs, long side of the court (the 18m side)
local COURT_WIDTH  = 54     -- studs, short side of the court (the 9m side)
local LINE_WIDTH   = 1.5    -- studs, thickness of the painted white lines
local LINE_LIFT    = 0.05   -- studs, how far lines sit above the sand (stops z-fighting flicker)

local FIELD_SIZE   = 400    -- studs, the big flat square everyone spawns on
local FIELD_HEIGHT = 4      -- studs, thickness of the ground slab

-- COLORS
local GRASS_COLOR = Color3.fromRGB(105, 170,  75)   -- surrounding field
local SAND_COLOR  = Color3.fromRGB(232, 205, 160)   -- the court surface
local LINE_COLOR  = Color3.fromRGB(255, 255, 255)   -- boundary/center/attack lines

-- Base Y level of the ground's TOP surface (the walkable height).
local GROUND_TOP_Y = FIELD_HEIGHT

-- CLEAN UP any previous build so re-running doesn't stack copies ------------
local existing = Workspace:FindFirstChild("VolleyballMap")
if existing then
	existing:Destroy()
end

local map = Instance.new("Model")
map.Name = "VolleyballMap"
map.Parent = Workspace

-- HELPER: make an anchored, non-collidable-or-collidable part ---------------
local function makePart(name, size, position, color, material, parent)
	local part = Instance.new("Part")
	part.Name       = name
	part.Size       = size
	part.Position   = position
	part.Anchored   = true          -- never falls or moves
	part.Color      = color
	part.Material   = material or Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent     = parent or map
	return part
end

-- 1) THE GROUND — one big flat slab the whole map sits on -------------------
makePart(
	"Ground",
	Vector3.new(FIELD_SIZE, FIELD_HEIGHT, FIELD_SIZE),
	Vector3.new(0, FIELD_HEIGHT / 2, 0),   -- centered so its top sits at GROUND_TOP_Y
	GRASS_COLOR,
	Enum.Material.Grass
)

-- 2) THE COURT SURFACE — sand rectangle in the middle ----------------------
-- Made slightly thin and laid on top of the ground.
local COURT_SLAB_H = 0.4
makePart(
	"CourtSurface",
	Vector3.new(COURT_LENGTH, COURT_SLAB_H, COURT_WIDTH),
	Vector3.new(0, GROUND_TOP_Y + COURT_SLAB_H / 2, 0),
	SAND_COLOR,
	Enum.Material.Sand
)

-- Top surface height of the sand — lines sit just above this.
local SAND_TOP_Y = GROUND_TOP_Y + COURT_SLAB_H

-- HELPER: paint a flat white line on the sand ------------------------------
-- lengthAlongX / widthAlongZ let us make lines running either direction.
local function makeLine(name, lengthAlongX, widthAlongZ, xCenter, zCenter)
	makePart(
		name,
		Vector3.new(lengthAlongX, 0.1, widthAlongZ),
		Vector3.new(xCenter, SAND_TOP_Y + LINE_LIFT, zCenter),
		LINE_COLOR,
		Enum.Material.SmoothPlastic
	)
end

-- 3) BOUNDARY LINES — the rectangle outline --------------------------------
local halfL = COURT_LENGTH / 2
local halfW = COURT_WIDTH / 2

-- Two long sidelines (run along X, positioned at +/- halfW on Z)
makeLine("Sideline_Near", COURT_LENGTH + LINE_WIDTH, LINE_WIDTH,  0,  halfW)
makeLine("Sideline_Far",  COURT_LENGTH + LINE_WIDTH, LINE_WIDTH,  0, -halfW)

-- Two short end lines (run along Z, positioned at +/- halfL on X)
makeLine("Endline_Left",  LINE_WIDTH, COURT_WIDTH + LINE_WIDTH, -halfL, 0)
makeLine("Endline_Right", LINE_WIDTH, COURT_WIDTH + LINE_WIDTH,  halfL, 0)

-- 4) CENTER LINE — splits the court into two halves ------------------------
makeLine("CenterLine", LINE_WIDTH, COURT_WIDTH, 0, 0)

-- 5) ATTACK LINES — 3m from center on each side ----------------------------
-- 3m of 18m == 1/6 of the length. So 1/6 of COURT_LENGTH from center.
local ATTACK_OFFSET = COURT_LENGTH / 6
makeLine("AttackLine_Left",  LINE_WIDTH, COURT_WIDTH, -ATTACK_OFFSET, 0)
makeLine("AttackLine_Right", LINE_WIDTH, COURT_WIDTH,  ATTACK_OFFSET, 0)

-- 6) SPAWN — drop players onto the field near the court --------------------
local spawn = Instance.new("SpawnLocation")
spawn.Name       = "CourtSpawn"
spawn.Size       = Vector3.new(6, 1, 6)
spawn.Position   = Vector3.new(0, GROUND_TOP_Y + 0.5, halfW + 20)  -- just off the sideline
spawn.Anchored   = true
spawn.Color      = Color3.fromRGB(70, 130, 200)
spawn.Material   = Enum.Material.SmoothPlastic
spawn.TopSurface = Enum.SurfaceType.Smooth
spawn.Parent     = map

print("[VolleyballMap] Built: flat field + volleyball court (no net).")
