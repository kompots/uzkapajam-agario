import "./style.css";
import tmi from "tmi.js";
import axios from "axios";

const clientId = "31oc8pz2llwa1yqcb0elm85akj2wgx";
const clientSecret = "1cjzpysdytcor6f3gvb38i1q7rtr54";

async function getAppToken() {
  const res = await axios.post("https://id.twitch.tv/oauth2/token", null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    },
  });
  return res.data.access_token;
}

async function getUserProfilePicture(username) {
  const token = await getAppToken();
  const res = await axios.get("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    params: {
      login: username,
    },
  });

  return res.data.data[0]?.profile_image_url || null;
}

const params = new URLSearchParams(window.location.search);
const channel = params.get("channel") || "uzkapajam";

const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: [channel],
});

client.connect();

client.on("message", (channel, tags, message, self) => {
  if (message.includes("!eat")) {
    let parts = message.split(" ");
    eatTargets[tags.username] = parts[1];
    console.log(eatTargets);
  } else if (message === "!stop") {
    delete eatTargets[tags.username];
  } else if (message === "!play") {
    play(tags);
  }
  if (players.length < 101) {
    play(tags);
  }
});

const tree_img = new Image();
tree_img.crossOrigin = "anonymous";
tree_img.src = "https://i.imgur.com/i7UkBx6.png";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const winnerDiv = document.getElementById("winner");
canvas.width = 1;
canvas.height = 1;

const players = [];
const food = [];
const spikedTrees = [];
// const explodedPlayerPieces = []; // Removed as pieces are now in 'players'
const eatTargets = {};
const particles = [];
const colors = [
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "lime",
  "cyan",
];
let gameResetting = false;

// Helper function to calculate the shortest path considering screen wrapping
function getShortestDelta(coord1, coord2, maxCoord) {
  const directDelta = coord2 - coord1;
  // Test wrapping in one direction (e.g., target appears on the right after wrapping from the left)
  const wrappedDelta1 = coord2 + maxCoord - coord1;
  // Test wrapping in the other direction (e.g., target appears on the left after wrapping from the right)
  const wrappedDelta2 = coord2 - maxCoord - coord1;

  if (
    Math.abs(directDelta) <= Math.abs(wrappedDelta1) &&
    Math.abs(directDelta) <= Math.abs(wrappedDelta2)
  ) {
    return directDelta;
  } else if (Math.abs(wrappedDelta1) < Math.abs(wrappedDelta2)) {
    return wrappedDelta1;
  } else {
    return wrappedDelta2;
  }
}

const NUM_SPIKED_TREES = 4;
const SPIKED_TREE_RADIUS = 20;
const SPIKED_TREE_RESPAWN_DELAY = 30000; // 15 seconds
let lastTreeRespawnTime = 0;

function trySpawnOneSpikedTree() {
  if (spikedTrees.length >= NUM_SPIKED_TREES) return false; // Already full

  const margin = SPIKED_TREE_RADIUS * 2;
  let x,
    y,
    safe = false;
  for (let attempts = 0; attempts < 20 && !safe; attempts++) {
    x = Math.random() * (canvas.width - 2 * margin) + margin;
    y = Math.random() * (canvas.height - 2 * margin) + margin;
    safe = !spikedTrees.some(
      (tree) =>
        Math.hypot(tree.x - x, tree.y - y) < tree.r + SPIKED_TREE_RADIUS + 20
    );
    // Also check against players to avoid spawning on top of them (optional but good)
    if (safe) {
      safe = !players.some(
        (p) => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20
      );
    }
    if (safe) {
      // safe = !explodedPlayerPieces.some(p => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20);
      // Check against all players, including pieces, as they are now in the same array
      safe = !players.some(
        (p) => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20
      );
    }
  }

  if (safe) {
    spikedTrees.push({
      x,
      y,
      r: SPIKED_TREE_RADIUS,
    });
    return true; // Successfully spawned one tree
  }
  return false; // Could not find a spot
}

function spawnSpikedTrees() {
  const margin = SPIKED_TREE_RADIUS * 2; // Ensure trees are not too close to edges
  while (spikedTrees.length < NUM_SPIKED_TREES) {
    let x,
      y,
      safe = false;
    for (let attempts = 0; attempts < 20 && !safe; attempts++) {
      // Try 20 times to find a spot
      x = Math.random() * (canvas.width - 2 * margin) + margin;
      y = Math.random() * (canvas.height - 2 * margin) + margin;
      // Check for overlap with other spiked trees
      safe = !spikedTrees.some(
        (tree) =>
          Math.hypot(tree.x - x, tree.y - y) < tree.r + SPIKED_TREE_RADIUS + 20
      );
      // Optional: Check for overlap with initial player spawn areas if necessary (for now, just other trees)
    }
    if (safe) {
      spikedTrees.push({
        x,
        y,
        r: SPIKED_TREE_RADIUS,
      });
    } else {
      // Could not find a safe spot for a tree after several attempts
      // This might happen if the canvas is too small or NUM_SPIKED_TREES is too high
      console.warn(
        "Could not place a spiked tree. Canvas might be too crowded."
      );
      break;
    }
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawSpikedTree(tree) {
  // Pulsation logic
  const baseRadius = SPIKED_TREE_RADIUS; // Base radius for pulsation
  const animationSpeed = 1500; // milliseconds for one full pulsation cycle (approx)
  const scaleFactor = 0.2; // Max increase factor (0.5 means 50% larger)

  // Calculate current scale based on time
  // (Math.sin(...) + 1) / 2 maps sin's -1 to 1 range to 0 to 1 range
  const currentScale =
    (Math.sin(Date.now() / (animationSpeed / (2 * Math.PI))) + 1) / 2;

  // Apply the animated radius to tree.r for this frame
  // This change will affect drawing and collision detection as tree.r is used elsewhere.
  tree.r = baseRadius + baseRadius * scaleFactor * currentScale;

  const numSpikes = 12; // Number of spikes around the tree
  const spikeLength = tree.r * 0.3; // Length of the spikes
  // const spikeBaseWidth = tree.r * 0.3; // Width of the base of each spike // Not used in current spike drawing

  // Draw the main body of the tree (circle)
  ctx.beginPath();
  ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
  ctx.fillStyle = "black"; // Or any other tree-like color
  ctx.fill();
  ctx.strokeStyle = "darkpurple";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.drawImage(
    tree_img,
    tree.x - tree.r,
    tree.y - tree.r,
    tree.r * 2,
    tree.r * 2
  );

  // Draw spikes
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;

    // More pointy spikes by adjusting control points for a triangle
    const outerPointX = tree.x + Math.cos(angle) * (tree.r + spikeLength * 1.5); // Make spikes more pointy
    const outerPointY = tree.y + Math.sin(angle) * (tree.r + spikeLength * 1.5);

    const baseAngleOffset = (Math.PI / numSpikes) * 0.5; // Adjust for spike width

    const point1X = tree.x + Math.cos(angle - baseAngleOffset) * tree.r;
    const point1Y = tree.y + Math.sin(angle - baseAngleOffset) * tree.r;

    const point2X = tree.x + Math.cos(angle + baseAngleOffset) * tree.r;
    const point2Y = tree.y + Math.sin(angle + baseAngleOffset) * tree.r;

    ctx.beginPath();
    ctx.moveTo(outerPointX, outerPointY); // Tip of the spike
    ctx.lineTo(point1X, point1Y); // Base point 1
    ctx.lineTo(point2X, point2Y); // Base point 2
    ctx.closePath();

    ctx.fillStyle = "purple"; // Color of the spikes
    ctx.fill();
    // Optional: Add a stroke to spikes
    // ctx.strokeStyle = "darkgreen";
    // ctx.lineWidth = 1;
    // ctx.stroke();
  }
}

async function play(data) {
  getUserProfilePicture(data.username).then((avatar_url) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = avatar_url;
    const radius = 30;
    let x,
      y,
      safe = false;
    for (let attempts = 0; attempts < 100 && !safe; attempts++) {
      x = Math.random() * (canvas.width - 2 * radius) + radius;
      y = Math.random() * (canvas.height - 2 * radius) + radius;
      safe = !players.some(
        (p) => Math.hypot(p.x - x, p.y - y) < p.r + radius + 10
      );
    }

    const player = {
      username: data.username,
      display_name: data.display_name || data.username,
      x,
      y,
      dx: 0,
      dy: 0,
      r: radius,
      targetR: radius,
      avatar: img,
      isPiece: false, // Explicitly set for normal players
      originalUsername: data.username, // Or null, let's use own username for consistency
      spawnTime: Date.now(), // Can be useful for all players
      stagnationCounter: 0,
      lastPosition: { x, y },
    };

    const existing = players.find(
      (p) => p.username === data.username && !p.isPiece
    ); // Ensure we don't overwrite a piece with a new player
    if (!existing) {
      players.push(player);
    }
  });
}

function spawnFood() {
  const foodSpawnMargin = 4; // Margin from canvas edges
  // const spikedTreeAvoidanceRadius = SPIKED_TREE_RADIUS + foodRadius + 10; // tree.r + food.r + buffer. Not directly used, but documents the value
  let attemptsToSpawn = 0; // To prevent infinite loops if space is very limited. Max 200 attempts for all food.

  while (food.length < 120 && attemptsToSpawn < 200) {
    let foodRadius = Math.floor(Math.random() * 9) + 2;
    attemptsToSpawn++;
    let x,
      y,
      safeToSpawn = false;
    let placementAttempts = 0; // Attempts to find a safe spot for the current food item

    while (!safeToSpawn && placementAttempts < 10) {
      placementAttempts++;
      x =
        Math.random() * (canvas.width - 2 * foodSpawnMargin) + foodSpawnMargin;
      y =
        Math.random() * (canvas.height - 2 * foodSpawnMargin) + foodSpawnMargin;
      safeToSpawn = true; // Assume safe until proven otherwise

      // Check proximity to spiked trees
      for (const tree of spikedTrees) {
        // SPIKED_TREE_RADIUS is globally defined as 20. tree.r should also be SPIKED_TREE_RADIUS
        if (Math.hypot(x - tree.x, y - tree.y) < tree.r + foodRadius + 10) {
          safeToSpawn = false;
          break;
        }
      }
    }

    if (safeToSpawn) {
      food.push({
        x: x,
        y: y,
        r: foodRadius,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }
}

function drawPlayer(p) {
  p.r += (p.targetR - p.r) * 0.15; // Smooth radius change

  const offsets = [-canvas.width, 0, canvas.width];
  for (const dx_offset of offsets) {
    for (const dy_offset of [-canvas.height, 0, canvas.height]) {
      const drawX = p.x + dx_offset;
      const drawY = p.y + dy_offset;

      ctx.beginPath();
      ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);

      if (p.isPiece) {
        // Changed from p.isExplodedPiece
        ctx.strokeStyle = "rgba(200, 200, 200, 0.7)"; // Lighter border for pieces
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = "grey";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      ctx.save();
      ctx.beginPath(); // Re-path for clipping
      ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
      ctx.clip();

      if (p.avatar && p.avatar.complete && p.avatar.naturalHeight !== 0) {
        try {
          ctx.drawImage(p.avatar, drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
        } catch (e) {
          // Fallback if drawImage fails (e.g. tainted canvas for certain SVGs)
          ctx.fillStyle = p.isPiece
            ? "rgba(120,120,120,0.5)"
            : "rgba(80,80,80,0.6)"; // Changed from p.isExplodedPiece
          ctx.fill(); // Fills the clipped arc
        }
      } else {
        // Fallback if avatar not loaded or missing
        ctx.fillStyle = p.isPiece
          ? "rgba(120,120,120,0.5)"
          : "rgba(80,80,80,0.6)"; // Changed from p.isExplodedPiece
        ctx.fill(); // Fills the clipped arc
      }

      const gradient = ctx.createRadialGradient(
        drawX,
        drawY,
        0,
        drawX,
        drawY,
        p.r
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)"); // Center: no blur
      gradient.addColorStop(0.7, "rgba(0, 0, 0, 0)"); // Mid-radius: no blur
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)"); // Edge: soft darkening

      ctx.fillStyle = gradient;
      ctx.fillRect(drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
      ctx.restore();

      ctx.fillStyle = "white";
      ctx.font = `${p.r / 3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "black";
      ctx.strokeText(p.display_name, drawX, drawY);
      ctx.fillText(p.display_name, drawX, drawY);
    }
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.02;
    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw spiked trees
  for (const tree of spikedTrees) {
    drawSpikedTree(tree);
  }

  if (
    spikedTrees.length < NUM_SPIKED_TREES &&
    Date.now() - lastTreeRespawnTime > SPIKED_TREE_RESPAWN_DELAY
  ) {
    if (trySpawnOneSpikedTree()) {
      lastTreeRespawnTime = Date.now();
    }
  }

  for (const f of food) {
    f.x += f.dx;
    f.y += f.dy;

    if (f.x < f.r || f.x > canvas.width - f.r) {
      f.dx *= -1;
      f.x = Math.max(f.r, Math.min(canvas.width - f.r, f.x));
    }
    if (f.y < f.r || f.y > canvas.height - f.r) {
      f.dy *= -1;
      f.y = Math.max(f.r, Math.min(canvas.height - f.r, f.y));
    }
  }

  // Player-Spiked Tree Collision
  for (let i = players.length - 1; i >= 0; i--) {
    const player = players[i];
    let collidedWithTree = false;

    for (let j = spikedTrees.length - 1; j >= 0; j--) {
      const tree = spikedTrees[j];
      const dx = player.x - tree.x;
      const dy = player.y - tree.y;
      const distance = Math.hypot(dx, dy);

      if (distance < player.r - 20 + tree.r && player.r > 50) {
        // Collision occurred
        collidedWithTree = true;

        const numPieces = Math.max(2, Math.floor(player.r / 25)); // Ensure at least 2 pieces
        const pieceBaseRadius = player.r / numPieces; // This is a simplification, area-based would be more accurate but complex for now

        for (let k = 0; k < numPieces; k++) {
          const angle =
            (k / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5; // Spread pieces out
          const pieceRadius = pieceBaseRadius * (0.8 + Math.random() * 0.65); // Slight size variation

          players.push({
            // Standard player properties:
            username: `${player.username}_piece_${Date.now()}_${k}`, // Unique username for the piece itself
            display_name: player.display_name, // Inherit display name
            x: player.x + (player.r / 2) * Math.cos(angle),
            y: player.y + (player.r / 2) * Math.sin(angle),
            dx: Math.cos(angle) * (2 + Math.random() * 2), // Explode outwards
            dy: Math.sin(angle) * (2 + Math.random() * 2),
            r: pieceRadius,
            targetR: pieceRadius,
            avatar: player.avatar, // Inherit avatar

            // New properties for pieces:
            isPiece: true,
            originalUsername: player.username, // Link to the original player
            spawnTime: Date.now(), // For re-merging logic later
          });
        }

        // Remove the original player
        players.splice(i, 1);

        // Remove the spiked tree (or mark inactive, for now, remove)
        spikedTrees.splice(j, 1);

        // Spawn particles for explosion effect
        for (let k = 0; k < 30; k++) {
          particles.push({
            x: player.x,
            y: player.y,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            alpha: 1,
            size: 3 + Math.random() * 3,
            color: "orange", // Explosion particle color
          });
        }

        break; // Player can only hit one tree at a time, exit inner loop
      }
    }
    if (collidedWithTree) {
      // Player was removed, so the loop continues from the new `i`
      // No need to `continue` here as `players.splice(i,1)` handles the iteration correctly for a reverse loop
    }
  }

  // Update and manage exploded player pieces
  // This loop is now part of the main players loop. The logic for attraction and merging will be adapted.
  // for (let i = explodedPlayerPieces.length - 1; i >= 0; i--) { ... } // REMOVE THIS LOOP STRUCTURE

  // The MERGE_TIME and related logic will need to be re-evaluated or moved.
  // For now, we remove the specific explodedPlayerPieces loop.
  // Attraction and merging logic will be addressed in subsequent steps based on the new structure.

  const MERGE_TIME = 30000; // 1 minute
  const usernamesToProcessForMerging = new Set();

  // Iterate over all players to find pieces eligible for merging
  players.forEach((player) => {
    if (player.isPiece && Date.now() - player.spawnTime > MERGE_TIME) {
      usernamesToProcessForMerging.add(player.originalUsername);
    }
  });

  for (const username of usernamesToProcessForMerging) {
    // Check if the original player (non-piece) is active
    const originalPlayerActive = players.some(
      (p) => p.username === username && !p.isPiece
    );

    if (originalPlayerActive) {
      // Original player is active, remove old pieces of this user
      for (let i = players.length - 1; i >= 0; i--) {
        if (
          players[i].isPiece &&
          players[i].originalUsername === username &&
          Date.now() - players[i].spawnTime > MERGE_TIME
        ) {
          players.splice(i, 1);
        }
      }
      continue; // Move to the next username
    }

    // Original player is not active, proceed with new merging logic
    let primaryPlayer = players.find(
      (p) => p.username === username && !p.isPiece
    );
    const userPieces = players.filter(
      (p) =>
        p.isPiece &&
        p.originalUsername === username &&
        Date.now() - p.spawnTime > MERGE_TIME
      //Pieces are already filtered by MERGE_TIME to be added to usernamesToProcessForMerging
      //but double check here won't hurt, or could be removed if performance critical
    );

    if (!primaryPlayer && userPieces.length > 0) {
      // Designate a primary player if one doesn't exist
      userPieces.sort((a, b) => {
        if (b.r !== a.r) {
          return b.r - a.r; // Sort by radius descending
        }
        return a.spawnTime - b.spawnTime; // Then by spawn time ascending
      });

      primaryPlayer = userPieces[0]; // Largest/oldest piece becomes primary
      primaryPlayer.isPiece = false;
      primaryPlayer.username = primaryPlayer.originalUsername;
      // display_name, avatar, x, y, r, targetR, dx, dy, originalUsername, spawnTime are retained.
      // No need to remove it from userPieces here.
      // The piece that became primary will not attract other pieces to itself in this loop,
      // nor will it be attracted in the player update loop as isPiece is false.
    }
    // If a primaryPlayer exists (either found or just designated),
    // all eligible userPieces (isPiece: true, originalUsername matches, past MERGE_TIME)
    // will be handled by the attraction/absorption logic in the main player update loop.
    // No players are removed or created here in this new logic.
    // The old logic of removing pieces here and creating a new merged player is now gone.
  }

  for (const f of food) {
    // let centroidY = 0; // centroidY was unused, removing
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  for (const p of players) {
    if (typeof p.stagnationCounter === "undefined") {
      p.stagnationCounter = 0;
    }
    if (typeof p.lastPosition === "undefined") {
      p.lastPosition = { x: p.x, y: p.y };
    }
    p.markedForRemoval = p.markedForRemoval || false; // Ensure flag exists

    let isAttractedToPrimary = false; // Flag to indicate if piece is moving towards a primary player

    // --- NEW MERGE ATTRACTION AND ABSORPTION LOGIC ---
    if (p.isPiece && Date.now() - p.spawnTime > MERGE_TIME) {
      const primaryPlayer = players.find(
        (op) => op.username === p.originalUsername && !op.isPiece
      );

      if (primaryPlayer && primaryPlayer !== p) {
        // Ensure piece is not targeting itself (e.g. if it just became primary)
        const MERGE_ATTRACTION_STRENGTH = 0.12; // Speed of attraction
        const ABSORPTION_DISTANCE_FACTOR = 1.0; // How close to be absorbed (factor of primary's radius)

        const dxToPrimary = getShortestDelta(
          p.x,
          primaryPlayer.x,
          canvas.width
        );
        const dyToPrimary = getShortestDelta(
          p.y,
          primaryPlayer.y,
          canvas.height
        );
        const distanceToPrimary = Math.hypot(dxToPrimary, dyToPrimary);

        // Absorption check: distance < primaryPlayer.r * factor
        if (distanceToPrimary < primaryPlayer.r * ABSORPTION_DISTANCE_FACTOR) {
          // Absorb piece
          const combinedArea =
            Math.PI * primaryPlayer.r * primaryPlayer.r + Math.PI * p.r * p.r;
          primaryPlayer.targetR = Math.sqrt(combinedArea / Math.PI);

          p.markedForRemoval = true; // Mark the piece for removal
          isAttractedToPrimary = true; // Stop other movements for this piece this frame
        } else if (distanceToPrimary > 0) {
          // Attract piece if not absorbing
          const normDx = dxToPrimary / distanceToPrimary;
          const normDy = dyToPrimary / distanceToPrimary;
          // Apply force directly, can be adjusted by player's speed/mass properties if needed
          p.dx += normDx * MERGE_ATTRACTION_STRENGTH;
          p.dy += normDy * MERGE_ATTRACTION_STRENGTH;
          isAttractedToPrimary = true;
        }
      }
    }

    if (p.markedForRemoval) {
      // If marked for removal, skip all other logic for this player.
      // Actual removal will happen after the main players loop.
      // Continue to next player in the loop essentially.
    } else if (isAttractedToPrimary) {
      // If attracted to primary, apply basic physics and continue.
      // No other AI (fleeing, food seeking, etc.) should apply.
      const speed = 1 * (30 / p.r); // Use existing speed calculation
      p.dx = Math.max(-speed, Math.min(speed, p.dx));
      p.dy = Math.max(-speed, Math.min(speed, p.dy));
      p.x += p.dx;
      p.y += p.dy;
      p.x = (p.x + canvas.width) % canvas.width;
      p.y = (p.y + canvas.height) % canvas.height;
      // Also update lastPosition and stagnationCounter if those are still relevant
      if (
        Math.hypot(p.x - p.lastPosition.x, p.y - p.lastPosition.y) < 0.1 &&
        Math.hypot(p.dx, p.dy) < 0.1
      ) {
        p.stagnationCounter++;
      } else {
        p.stagnationCounter = 0;
      }
      p.lastPosition = { x: p.x, y: p.y };
    } else {
      // --- START OF ORIGINAL AI LOGIC (conditionally executed) ---
      // This 'else' block now contains all the previous AI decision making
      // (piece clustering, food seeking for pieces, general AI for all)

      if (p.isPiece) {
        // This is the old piece logic (clustering / food for pieces not merging to primary)
        const parentExists = players.some(
          (parent) => parent.username === p.originalUsername && !parent.isPiece
        );
        let isAttractedToCluster = false;

        // Only cluster if the original player is gone AND the piece is not yet eligible/attracted to a primary
        if (!parentExists) {
          const siblingPieces = players.filter(
            (s) =>
              s.isPiece && s.originalUsername === p.originalUsername && s !== p
          );

          if (siblingPieces.length > 0) {
            let centroidX = 0;
            let centroidY = 0;
            let totalSiblingEffectiveMass = 0;

            for (const sibling of siblingPieces) {
              const mass = sibling.r * sibling.r; // Use area as mass proxy
              centroidX += sibling.x * mass;
              centroidY += sibling.y * mass;
              totalSiblingEffectiveMass += mass;
            }

            if (totalSiblingEffectiveMass > 0) {
              centroidX /= totalSiblingEffectiveMass;
              centroidY /= totalSiblingEffectiveMass;

              const dxToCentroid = getShortestDelta(
                p.x,
                centroidX,
                canvas.width
              );
              const dyToCentroid = getShortestDelta(
                p.y,
                centroidY,
                canvas.height
              );
              const distanceToCentroid = Math.hypot(dxToCentroid, dyToCentroid);

              const CLUSTER_ATTRACTION_STRENGTH = 0.08;
              const MIN_DISTANCE_TO_APPLY_FORCE = p.r * 1.05;

              if (distanceToCentroid > MIN_DISTANCE_TO_APPLY_FORCE) {
                const normDx = dxToCentroid / distanceToCentroid;
                const normDy = dyToCentroid / distanceToCentroid;
                const effectiveStrength =
                  CLUSTER_ATTRACTION_STRENGTH *
                  Math.min(distanceToCentroid / 1000.0, 1.0);

                p.dx += normDx * effectiveStrength;
                p.dy += normDy * effectiveStrength;
                isAttractedToCluster = true;
              }
            }
          }
        }

        // Food seeking for pieces (if not merging to primary and potentially clustering)
        const PIECE_FOOD_SEEK_RADIUS = p.r * 1;
        const PIECE_FOOD_ATTRACTION_STRENGTH = 0.01;
        let closestFood = null;
        let minDistToFood = PIECE_FOOD_SEEK_RADIUS;

        for (const f of food) {
          const distToFood = Math.hypot(p.x - f.x, p.y - f.y);
          if (distToFood < minDistToFood && distToFood > p.r * 0.5) {
            minDistToFood = distToFood;
            closestFood = f;
          }
        }

        if (closestFood) {
          const dxToFood = closestFood.x - p.x;
          const dyToFood = closestFood.y - p.y;
          const normDxToFood = dxToFood / minDistToFood;
          const normDyToFood = dyToFood / minDistToFood;
          const actualFoodAttractionStrength = isAttractedToCluster
            ? PIECE_FOOD_ATTRACTION_STRENGTH * 0.5
            : PIECE_FOOD_ATTRACTION_STRENGTH;
          p.dx += normDxToFood * actualFoodAttractionStrength;
          p.dy += normDyToFood * actualFoodAttractionStrength;
        }
      }

      // Player state variables for movement decisions each tick
      let fleeing = false;
      let target = null; // Target object {dx, dy, dist} if player p is pursuing something
      let avoidingSpikes = false; // True if spike avoidance maneuver is active for player p
      const forcedTargetUsername = eatTargets[p.username]; // Username of the forced target, if any
      let isPursuingForcedTarget = false; // True if player p is acting on a forced target this tick

      // 1. Handle Forced Targets (Highest Priority)
      if (forcedTargetUsername) {
        const victim = players.find((x) => x.username === forcedTargetUsername);
        if (victim && victim !== p) {
          const targetDx = getShortestDelta(p.x, victim.x, canvas.width);
          const targetDy = getShortestDelta(p.y, victim.y, canvas.height);
          const dist = Math.hypot(targetDx, targetDy);

          if (dist > 0) {
            target = { dx: targetDx, dy: targetDy, dist: dist };
            isPursuingForcedTarget = true;
            fleeing = false; // Forced target overrides fleeing
          } else {
            delete eatTargets[p.username]; // Target is too close or invalid, clear command
          }
        } else {
          delete eatTargets[p.username]; // Victim not found, clear command
        }
      }

      // 2. If not pursuing a forced target, consider AI behaviors (Spike Avoidance, General AI)
      if (!isPursuingForcedTarget) {
        // 2a. Spike Tree Avoidance (scaled for non-piece players)
        if (!p.isPiece && Math.random() < 0.75) {
          // Removed p.r < 50 condition
          let totalRepulsionDx = 0;
          let totalRepulsionDy = 0;
          let spikeNearby = false;

          for (const tree of spikedTrees) {
            const distToTree = Math.hypot(p.x - tree.x, p.y - tree.y);
            // Scaled dangerRadius: awareness decreases for larger players
            const dangerRadius = tree.r + p.r + Math.max(50 - p.r / 2, 10.0);

            if (distToTree < dangerRadius && distToTree > 0) {
              const repulsionDx = p.x - tree.x;
              const repulsionDy = p.y - tree.y;
              const normRepulsionDxFromTree = repulsionDx / distToTree;
              const normRepulsionDyFromTree = repulsionDy / distToTree;
              const weight = (dangerRadius - distToTree) / dangerRadius;
              totalRepulsionDx += normRepulsionDxFromTree * weight;
              totalRepulsionDy += normRepulsionDyFromTree * weight;
              spikeNearby = true;
            }
          }

          if (spikeNearby) {
            const magnitude = Math.hypot(totalRepulsionDx, totalRepulsionDy);
            if (magnitude > 0) {
              const finalRepulsionDx = totalRepulsionDx / magnitude;
              const finalRepulsionDy = totalRepulsionDy / magnitude;
              // Scaled avoidanceStrength: larger players are less affected
              const avoidanceStrength = Math.max(0.15 - p.r / 1000, 0.02);

              p.dx += finalRepulsionDx * avoidanceStrength;
              p.dy += finalRepulsionDy * avoidanceStrength;

              avoidingSpikes = true;
              target = null;
            }
          }
        }

        // 2b. General AI (Fleeing, Attacking other players, Food Seeking)
        if (!avoidingSpikes) {
          let potentialAttackTarget = null;
          let localTargetDist = Infinity;
          let soughtCluster = false;

          if (!fleeing) {
            for (const other of players) {
              if (p === other) continue;
              if (
                p.isPiece &&
                other.username === p.originalUsername &&
                !other.isPiece
              )
                continue;
              if (
                !p.isPiece &&
                other.isPiece &&
                other.originalUsername === p.username
              )
                continue;

              const vec_p_to_other_x = getShortestDelta(
                p.x,
                other.x,
                canvas.width
              );
              const vec_p_to_other_y = getShortestDelta(
                p.y,
                other.y,
                canvas.height
              );
              const dist_p_to_other = Math.hypot(
                vec_p_to_other_x,
                vec_p_to_other_y
              );

              if (dist_p_to_other === 0) continue;

              if (other.r > p.r * 1.1 && dist_p_to_other < other.r * 2) {
                p.dx -= (vec_p_to_other_x / dist_p_to_other) * 0.15;
                p.dy -= (vec_p_to_other_y / dist_p_to_other) * 0.15;
                fleeing = true;
                target = null;
                potentialAttackTarget = null;
                break;
              } else if (
                !fleeing &&
                p.r > other.r * 1.1 &&
                dist_p_to_other < 500 &&
                dist_p_to_other < localTargetDist
              ) {
                potentialAttackTarget = {
                  dx: vec_p_to_other_x,
                  dy: vec_p_to_other_y,
                  dist: dist_p_to_other,
                };
                localTargetDist = dist_p_to_other;
              }
            }
          }

          if (!fleeing && !p.isPiece) {
            const MIN_CLUSTER_SIZE = 2;
            const CLUSTER_RADIUS_CHECK = p.r * 5.5;
            const MAX_DIST_TO_CLUSTER_CENTER = p.r * 5;
            const SMALL_PLAYER_MAX_RADIUS = p.r * 0.6;
            let bestClusterCentroid = null;
            let maxClusterScore = 0;

            for (const potentialCenterPlayer of players) {
              if (
                potentialCenterPlayer === p ||
                potentialCenterPlayer.r >= SMALL_PLAYER_MAX_RADIUS ||
                potentialCenterPlayer.isPiece
              )
                continue;
              if (
                Math.hypot(
                  p.x - potentialCenterPlayer.x,
                  p.y - potentialCenterPlayer.y
                ) >
                MAX_DIST_TO_CLUSTER_CENTER + CLUSTER_RADIUS_CHECK
              )
                continue;

              let currentClusterMembers = [];
              let sumX = 0,
                sumY = 0,
                totalMassEquivalent = 0;
              for (const memberPlayer of players) {
                if (
                  memberPlayer === p ||
                  memberPlayer.r >= SMALL_PLAYER_MAX_RADIUS ||
                  memberPlayer.isPiece
                )
                  continue;
                if (memberPlayer.originalUsername === p.username) continue;
                if (
                  Math.hypot(
                    potentialCenterPlayer.x - memberPlayer.x,
                    potentialCenterPlayer.y - memberPlayer.y
                  ) < CLUSTER_RADIUS_CHECK
                ) {
                  currentClusterMembers.push(memberPlayer);
                  sumX += memberPlayer.x * memberPlayer.r;
                  sumY += memberPlayer.y * memberPlayer.r;
                  totalMassEquivalent += memberPlayer.r;
                }
              }

              if (
                currentClusterMembers.length >= MIN_CLUSTER_SIZE &&
                totalMassEquivalent > 0
              ) {
                const centroidX = sumX / totalMassEquivalent;
                const centroidY = sumY / totalMassEquivalent;
                const dCx = getShortestDelta(p.x, centroidX, canvas.width);
                const dCy = getShortestDelta(p.y, centroidY, canvas.height);
                const distToCentroid = Math.hypot(dCx, dCy);
                if (
                  distToCentroid < MAX_DIST_TO_CLUSTER_CENTER &&
                  distToCentroid > 1
                ) {
                  const score =
                    (currentClusterMembers.length * totalMassEquivalent) /
                    (distToCentroid * distToCentroid + 1);
                  if (score > maxClusterScore) {
                    maxClusterScore = score;
                    bestClusterCentroid = {
                      dx_to_p: dCx,
                      dy_to_p: dCy,
                      dist: distToCentroid,
                    };
                  }
                }
              }
            }
            if (bestClusterCentroid) {
              target = {
                dx: bestClusterCentroid.dx_to_p,
                dy: bestClusterCentroid.dy_to_p,
                dist: bestClusterCentroid.dist,
              };
              soughtCluster = true;
              potentialAttackTarget = null;
            }
          }

          if (!fleeing && !soughtCluster && potentialAttackTarget) {
            target = potentialAttackTarget;
          }

          if (!fleeing && !target) {
            let bestFoodCluster = null;
            let bestFoodScore = 0;
            for (const f of food) {
              const foodClusterDensityCheck = food.filter((o) => {
                const dfx = getShortestDelta(f.x, o.x, canvas.width);
                const dfy = getShortestDelta(f.y, o.y, canvas.height);
                return Math.hypot(dfx, dfy) < 80;
              });
              const foodDx = getShortestDelta(p.x, f.x, canvas.width);
              const foodDy = getShortestDelta(p.y, f.y, canvas.height);
              const distToFood = Math.hypot(foodDx, foodDy);
              if (distToFood < 30 || distToFood === 0) continue;
              const score = foodClusterDensityCheck.length / distToFood;
              if (score > bestFoodScore) {
                bestFoodScore = score;
                bestFoodCluster = foodClusterDensityCheck;
              }
            }
            if (bestFoodCluster && bestFoodCluster.length > 0) {
              const avgX =
                bestFoodCluster.reduce((sum, f) => sum + f.x, 0) /
                bestFoodCluster.length;
              const avgY =
                bestFoodCluster.reduce((sum, f) => sum + f.y, 0) /
                bestFoodCluster.length;
              const targetDx = getShortestDelta(p.x, avgX, canvas.width);
              const targetDy = getShortestDelta(p.y, avgY, canvas.height);
              const distToFoodCluster = Math.hypot(targetDx, targetDy);
              if (distToFoodCluster > 1) {
                target = {
                  dx: targetDx,
                  dy: targetDy,
                  dist: distToFoodCluster,
                };
              }
            }
          }
        }
      }

      // 3. Movement Application
      if (target && !fleeing && target.dist > 1) {
        const normX = target.dx / target.dist;
        const normY = target.dy / target.dist;

        if (isPursuingForcedTarget) {
          const forcedAccel = 1;
          p.dx += normX * forcedAccel;
          p.dy += normY * forcedAccel;
          p.dx *= 0.95;
          p.dy *= 0.95;
        } else {
          if (target.dist < 60) {
            const correction = 1;
            const align = 0.7;
            p.dx = p.dx * align + normX * correction;
            p.dy = p.dy * align + normY * correction;
          }
          const standardAccel = 0.015;
          p.dx += normX * standardAccel;
          p.dy += normY * standardAccel;
        }
      }

      const speed = 1 * (30 / p.r);
      p.dx = Math.max(-speed, Math.min(speed, p.dx));
      p.dy = Math.max(-speed, Math.min(speed, p.dy));

      p.x += p.dx;
      p.y += p.dy;

      p.x = (p.x + canvas.width) % canvas.width;
      p.y = (p.y + canvas.height) % canvas.height;

      // Stuck player detection and nudge (this was inside the 'else' block, so it's fine)
      if (
        Math.hypot(p.x - p.lastPosition.x, p.y - p.lastPosition.y) < 0.1 &&
        Math.hypot(p.dx, p.dy) < 0.1
      ) {
        p.stagnationCounter++;
      } else {
        p.stagnationCounter = 0;
      }
      p.lastPosition = { x: p.x, y: p.y };

      if (p.stagnationCounter > 20) {
        const hasValidCloseTarget = target && target.dist < p.r;
        if (!hasValidCloseTarget && !fleeing && !p.isPiece) {
          const nudgeStrength = 0.05;
          p.dx += (Math.random() - 0.5) * nudgeStrength;
          p.dy += (Math.random() - 0.5) * nudgeStrength;
          p.stagnationCounter = 0;
        } else if (p.isPiece && p.stagnationCounter > 60) {
          // For pieces not merging to primary and potentially stuck in a cluster
          const nudgeStrength = 0.02;
          p.dx += (Math.random() - 0.5) * nudgeStrength;
          p.dy += (Math.random() - 0.5) * nudgeStrength;
          p.stagnationCounter = 0;
        }
      }
    } // --- END OF ORIGINAL AI LOGIC (conditional execution) ---
  }

  // Filter out players marked for removal (e.g. absorbed pieces)
  // This must be done *after* the loop iterating over players concludes.
  const activePlayers = [];
  for (const p of players) {
    if (!p.markedForRemoval) {
      activePlayers.push(p);
    }
  }
  players.length = 0; // Clear the original array
  players.push(...activePlayers); // Add back only active players

  for (const p of players) {
    // This loop is for food eating, should be fine
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i];
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      if (Math.hypot(dx, dy) < p.r) {
        const growth = (f.r * 2) / p.r; // Changed growth calculation
        p.targetR += growth;
        console.log("Augonis: ", growth, " masa: ", p.targetR);
        food.splice(i, 1);
      }
    }
  }

  for (let i = players.length - 1; i >= 0; i--) {
    const p1 = players[i];
    for (let j = players.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const p2 = players[j];

      if (
        p1.isPiece &&
        p2.isPiece &&
        p1.originalUsername === p2.originalUsername
      ) {
        continue;
      }

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < p1.r && p1.r > p2.r * 1.1) {
        const area1 = Math.PI * p1.r * p1.r;
        const area2 = Math.PI * p2.r * p2.r;
        const newArea = area1 + area2;
        p1.targetR = Math.sqrt(newArea / Math.PI);

        for (let j = 0; j < 20; j++) {
          particles.push({
            x: p2.x,
            y: p2.y,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            alpha: 1,
            size: 6 + Math.random() * 4,
            color: "white",
          });
        }

        delete eatTargets[p2.username]; // This might need more context if eatTargets is used for pieces vs full players
        if (eatTargets[p1.username] === p2.username)
          delete eatTargets[p1.username];

        players.splice(j, 1);
        // If i (p1's index) was greater than j (p2's index), decrement i because an element before it was removed.
        if (i > j) {
          i--;
        }
        break;
      }
    }
  }

  players.sort((a, b) => a.r - b.r);
  for (const p of players) drawPlayer(p);

  // Add after the above loop:
  // for (const piece of explodedPlayerPieces) { // REMOVED - pieces drawn by main players loop
  //   drawPlayer(piece);
  // }

  drawParticles();
  spawnFood();

  const scoreboardEntries = [];

  // Add active players from the 'players' array
  for (const player of players) {
    scoreboardEntries.push({
      display_name: player.display_name,
      username: player.username,
      score: player.r,
    });
  }

  // Find unique original players from pieces in the 'players' array
  const pieceUsernames = new Set();
  players.forEach((p) => {
    if (p.isPiece) {
      pieceUsernames.add(p.originalUsername);
    }
  });

  // For each original player who has pieces, find their largest piece for scoreboard
  for (const username of pieceUsernames) {
    // Only add to scoreboard if the original, non-piece player is NOT currently active
    if (!players.some((p) => p.username === username && !p.isPiece)) {
      let largestPieceRadius = 0;
      let displayName = "";
      players.forEach((p) => {
        if (p.isPiece && p.originalUsername === username) {
          if (p.r > largestPieceRadius) {
            largestPieceRadius = p.r;
          }
          if (!displayName) displayName = p.display_name;
        }
      });
      if (largestPieceRadius > 0) {
        // Check if this entry already exists (e.g. from the main players loop if a piece became a player)
        // to avoid duplicates if a merged player is also somehow still having pieces listed.
        // This is a safeguard, ideally merge logic handles it.
        if (!scoreboardEntries.some((e) => e.username === username)) {
          scoreboardEntries.push({
            display_name: displayName || username,
            username: username, // original username
            score: largestPieceRadius,
          });
        }
      }
    }
  }

  // Sort all entries by score
  const sortedScoreboardEntries = scoreboardEntries.sort(
    (a, b) => b.score - a.score
  );
  // Determine how many entries to actually show (top 20 max)
  const entriesToDisplayCount = Math.min(sortedScoreboardEntries.length, 20);

  // Draw scoreboard background with dynamic height
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(20, 20, 220, 36 + entriesToDisplayCount * 26);

  // Draw scoreboard title
  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("🏆 Resnīši:", 30, 45);

  // Draw the top scoreboard entries
  sortedScoreboardEntries
    .slice(0, entriesToDisplayCount)
    .forEach((entry, i) => {
      ctx.fillText(
        `${i + 1}. ${entry.display_name} (${Math.round(entry.score)})`,
        30,
        70 + i * 25
      );
    });

  const winner = players.find((p) => p.r >= 300);
  if (winner && !gameResetting) {
    winnerDiv.textContent = `🏆 ${winner.display_name} uzvarēja!`;
    winnerDiv.style.display = "block";
    gameResetting = true;

    setTimeout(() => {
      players.length = 0;
      food.length = 0;
      for (const key in eatTargets) delete eatTargets[key];
      winnerDiv.style.display = "none";
      gameResetting = false;
      requestAnimationFrame(animate);
    }, 10000);
    return;
  }

  requestAnimationFrame(animate);
}

// Initial setup:
resizeCanvas(); // Set initial canvas size
spawnSpikedTrees(); // Spawn trees based on initial size
animate(); // Start the game loop
