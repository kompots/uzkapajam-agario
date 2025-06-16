import './style.css'
import tmi from 'tmi.js';
import axios from 'axios';

const clientId = '31oc8pz2llwa1yqcb0elm85akj2wgx';
const clientSecret = '1cjzpysdytcor6f3gvb38i1q7rtr54';

async function getAppToken() {
  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    }
  });
  return res.data.access_token;
}

async function getUserProfilePicture(username) {
  const token = await getAppToken();
  const res = await axios.get('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`
    },
    params: {
      login: username
    }
  });

  return res.data.data[0]?.profile_image_url || null;
}


const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true
  },
  channels: ['shroud']
});

client.connect();

client.on('message', (channel, tags, message, self) => {
  let cmds = ["!play", "!eat"]
  message = cmds[Math.floor(Math.random() * cmds.length)];
    if (message.includes("!eat")) {
      let parts = message.split(' ');
      parts[1] = players[Math.floor(Math.random() * players.length)]
      eatTargets[tags.username] = parts[1];
    } else if (message === "!stop") {
      delete eatTargets[tags.username];
    }
    else {
      play(tags)
    }
});


const tree_img = new Image();
tree_img.crossOrigin = "anonymous";
tree_img.src = 'https://i.imgur.com/i7UkBx6.png'

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
    const colors = ["red", "blue", "green", "yellow", "orange", "purple", "lime", "cyan"];
    let gameResetting = false;

// Helper function to calculate the shortest path considering screen wrapping
function getShortestDelta(coord1, coord2, maxCoord) {
    const directDelta = coord2 - coord1;
    // Test wrapping in one direction (e.g., target appears on the right after wrapping from the left)
    const wrappedDelta1 = (coord2 + maxCoord) - coord1;
    // Test wrapping in the other direction (e.g., target appears on the left after wrapping from the right)
    const wrappedDelta2 = (coord2 - maxCoord) - coord1;

    if (Math.abs(directDelta) <= Math.abs(wrappedDelta1) && Math.abs(directDelta) <= Math.abs(wrappedDelta2)) {
        return directDelta;
    } else if (Math.abs(wrappedDelta1) < Math.abs(wrappedDelta2)) {
        return wrappedDelta1;
    } else {
        return wrappedDelta2;
    }
}

    const NUM_SPIKED_TREES =4;
    const SPIKED_TREE_RADIUS = 20;
    const SPIKED_TREE_RESPAWN_DELAY = 30000; // 15 seconds
    let lastTreeRespawnTime = 0;

    function trySpawnOneSpikedTree() {
      if (spikedTrees.length >= NUM_SPIKED_TREES) return false; // Already full

      const margin = SPIKED_TREE_RADIUS * 2;
      let x, y, safe = false;
      for (let attempts = 0; attempts < 20 && !safe; attempts++) {
        x = Math.random() * (canvas.width - 2 * margin) + margin;
        y = Math.random() * (canvas.height - 2 * margin) + margin;
        safe = !spikedTrees.some(tree => Math.hypot(tree.x - x, tree.y - y) < tree.r + SPIKED_TREE_RADIUS + 20);
        // Also check against players to avoid spawning on top of them (optional but good)
        if (safe) {
           safe = !players.some(p => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20);
        }
        if (safe) {
           // safe = !explodedPlayerPieces.some(p => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20);
           // Check against all players, including pieces, as they are now in the same array
           safe = !players.some(p => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20);
        }
      }

      if (safe) {
        spikedTrees.push({
          x,
          y,
          r: SPIKED_TREE_RADIUS
        });
        return true; // Successfully spawned one tree
      }
      return false; // Could not find a spot
    }

    function spawnSpikedTrees() {
      const margin = SPIKED_TREE_RADIUS * 2; // Ensure trees are not too close to edges
      while (spikedTrees.length < NUM_SPIKED_TREES) {
        let x, y, safe = false;
        for (let attempts = 0; attempts < 20 && !safe; attempts++) { // Try 20 times to find a spot
          x = Math.random() * (canvas.width - 2 * margin) + margin;
          y = Math.random() * (canvas.height - 2 * margin) + margin;
          // Check for overlap with other spiked trees
          safe = !spikedTrees.some(tree => Math.hypot(tree.x - x, tree.y - y) < tree.r + SPIKED_TREE_RADIUS + 20);
          // Optional: Check for overlap with initial player spawn areas if necessary (for now, just other trees)
        }
        if (safe) {
          spikedTrees.push({
            x,
            y,
            r: SPIKED_TREE_RADIUS
          });
        } else {
          // Could not find a safe spot for a tree after several attempts
          // This might happen if the canvas is too small or NUM_SPIKED_TREES is too high
          console.warn("Could not place a spiked tree. Canvas might be too crowded.");
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
      ctx.drawImage(tree_img, tree.x - tree.r, tree.y - tree.r, tree.r * 2, tree.r * 2);
      

      // Draw spikes
      for (let i = 0; i < numSpikes; i++) {
        const angle = (i / numSpikes) * Math.PI * 2;

        // More pointy spikes by adjusting control points for a triangle
        const outerPointX = tree.x + Math.cos(angle) * (tree.r + spikeLength * 1.5); // Make spikes more pointy
        const outerPointY = tree.y + Math.sin(angle) * (tree.r + spikeLength * 1.5);

        const baseAngleOffset = Math.PI / numSpikes * 0.5; // Adjust for spike width

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
      const img = new Image();
      img.crossOrigin = "anonymous";
      getUserProfilePicture(data.username).then((data) => {
        img.src = data
      });

      const radius = 30;
      let x, y, safe = false;
      for (let attempts = 0; attempts < 100 && !safe; attempts++) {
        x = Math.random() * (canvas.width - 2 * radius) + radius;
        y = Math.random() * (canvas.height - 2 * radius) + radius;
        safe = !players.some(p => Math.hypot(p.x - x, p.y - y) < p.r + radius + 10);
      }

      const player = {
        username: data.username,
        display_name: data.display_name || data.username,
        x, y,
        dx: 0, dy: 0,
        r: radius,
        targetR: radius,
        avatar: img,
        isPiece: false, // Explicitly set for normal players
        originalUsername: data.username, // Or null, let's use own username for consistency
        spawnTime: Date.now(), // Can be useful for all players
        stagnationCounter: 0,
        lastPosition: { x, y }
      };

      const existing = players.find(p => p.username === data.username && !p.isPiece); // Ensure we don't overwrite a piece with a new player
      if (!existing) {
        players.push(player);
      }
    }

    function spawnFood() {
      const foodRadius = 4;
      const foodSpawnMargin = 40; // Margin from canvas edges
      // const spikedTreeAvoidanceRadius = SPIKED_TREE_RADIUS + foodRadius + 10; // tree.r + food.r + buffer. Not directly used, but documents the value
      let attemptsToSpawn = 0; // To prevent infinite loops if space is very limited. Max 200 attempts for all food.

      while (food.length < 120 && attemptsToSpawn < 200) {
        attemptsToSpawn++;
        let x, y, safeToSpawn = false;
        let placementAttempts = 0; // Attempts to find a safe spot for the current food item

        while (!safeToSpawn && placementAttempts < 10) {
          placementAttempts++;
          x = Math.random() * (canvas.width - 2 * foodSpawnMargin) + foodSpawnMargin;
          y = Math.random() * (canvas.height - 2 * foodSpawnMargin) + foodSpawnMargin;
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
            color: colors[Math.floor(Math.random() * colors.length)]
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

          if (p.isPiece) { // Changed from p.isExplodedPiece
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
              ctx.fillStyle = p.isPiece ? "rgba(120,120,120,0.5)" : "rgba(80,80,80,0.6)"; // Changed from p.isExplodedPiece
              ctx.fill(); // Fills the clipped arc
            }
          } else {
            // Fallback if avatar not loaded or missing
            ctx.fillStyle = p.isPiece ? "rgba(120,120,120,0.5)" : "rgba(80,80,80,0.6)"; // Changed from p.isExplodedPiece
            ctx.fill(); // Fills the clipped arc
          }

          const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.r);
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");     // Center: no blur
          gradient.addColorStop(0.7, "rgba(0, 0, 0, 0)");   // Mid-radius: no blur
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");   // Edge: soft darkening

          ctx.fillStyle = gradient;
          ctx.fillRect(drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
          ctx.restore();

          ctx.fillStyle = "white";
          ctx.font = `${p.r/3} sans-serif`;
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

      if (spikedTrees.length < NUM_SPIKED_TREES && Date.now() - lastTreeRespawnTime > SPIKED_TREE_RESPAWN_DELAY) {
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

          if (distance < (player.r / 3) + tree.r && player.r > 50 ) {
            // Collision occurred
            collidedWithTree = true;

            const numPieces = Math.max(2, Math.floor(player.r / 25)); // Ensure at least 2 pieces
            const pieceBaseRadius = player.r / numPieces; // This is a simplification, area-based would be more accurate but complex for now

            for (let k = 0; k < numPieces; k++) {
              const angle = (k / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5; // Spread pieces out
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
                  spawnTime: Date.now() // For re-merging logic later
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
                color: "orange" // Explosion particle color
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


      const MERGE_TIME = 60000; // 1 minute
      const usernamesToProcessForMerging = new Set();

      // Iterate over all players to find pieces eligible for merging
      players.forEach(player => {
        if (player.isPiece && Date.now() - player.spawnTime > MERGE_TIME) {
          usernamesToProcessForMerging.add(player.originalUsername);
        }
      });

      for (const username of usernamesToProcessForMerging) {
        // Check if the original player (non-piece) is active
        const originalPlayerActive = players.some(p => p.username === username && !p.isPiece);

        if (originalPlayerActive) {
          // Original player is active, remove old pieces of this user
          for (let i = players.length - 1; i >= 0; i--) {
            if (players[i].isPiece && players[i].originalUsername === username && (Date.now() - players[i].spawnTime > MERGE_TIME)) {
              players.splice(i, 1);
            }
          }
          continue; // Move to the next username
        }

        // Original player is not active, proceed to merge pieces
        const piecesToMerge = [];
        let totalArea = 0;
        let sumX = 0, sumY = 0, totalWeightForCentroid = 0;
        let originalPlayerAvatar = null;
        let originalPlayerDisplayName = "";

        // Collect all pieces (old and new) for this originalUsername
        for (let i = players.length - 1; i >= 0; i--) {
          const p = players[i];
          if (p.isPiece && p.originalUsername === username) {
            piecesToMerge.push(p);
            totalArea += Math.PI * p.r * p.r;
            sumX += p.x * p.r;
            sumY += p.y * p.r;
            totalWeightForCentroid += p.r;
            if (!originalPlayerAvatar) originalPlayerAvatar = p.avatar;
            if (!originalPlayerDisplayName) originalPlayerDisplayName = p.display_name;
            players.splice(i, 1); // Remove piece as it's being merged
          }
        }

        if (piecesToMerge.length > 0) {
          const mergedPlayerRadius = Math.sqrt(totalArea / Math.PI);
          const mergedPlayerX = totalWeightForCentroid > 0 ? sumX / totalWeightForCentroid : piecesToMerge[0].x;
          const mergedPlayerY = totalWeightForCentroid > 0 ? sumY / totalWeightForCentroid : piecesToMerge[0].y;

          players.push({
            username: username, // Use original username for the reformed player
            display_name: originalPlayerDisplayName || username,
            x: mergedPlayerX,
            y: mergedPlayerY,
            dx: 0,
            dy: 0,
            r: mergedPlayerRadius,
            targetR: mergedPlayerRadius,
            avatar: originalPlayerAvatar,
            isPiece: false, // Reformed player is not a piece
            originalUsername: username, // Set to its own username
            spawnTime: Date.now() // New spawn time for the merged entity
          });
        }
      }

      for (const f of food) {
            let centroidY = 0;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
      }

      for (const p of players) {
        if (typeof p.stagnationCounter === 'undefined') {
            p.stagnationCounter = 0;
        }
        if (typeof p.lastPosition === 'undefined') {
            p.lastPosition = { x: p.x, y: p.y };
        }

        if (p.isPiece) {
            const parentExists = players.some(parent => parent.username === p.originalUsername && !parent.isPiece);
            let isAttractedToCluster = false;

            if (!parentExists) { // Only cluster if the original player is gone
                const siblingPieces = players.filter(s => s.isPiece && s.originalUsername === p.originalUsername && s !== p);

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

                        const dxToCentroid = centroidX - p.x;
                        const dyToCentroid = centroidY - p.y;
                        const distanceToCentroid = Math.hypot(dxToCentroid, dyToCentroid);

                        const CLUSTER_ATTRACTION_STRENGTH = 0.04; // Significantly increased
                        const MIN_DISTANCE_TO_APPLY_FORCE = p.r * 0.5; // Dead zone: don't apply if closer than half its radius

                        if (distanceToCentroid > MIN_DISTANCE_TO_APPLY_FORCE) {
                            // Normalized direction vector to centroid
                            const normDx = dxToCentroid / distanceToCentroid;
                            const normDy = dyToCentroid / distanceToCentroid;

                            // Apply a consistent force towards the centroid.
                            // The force can be stronger if further away, capped at some max influence per tick.
                            const effectiveStrength = CLUSTER_ATTRACTION_STRENGTH * Math.min(distanceToCentroid / 150.0, 1.0); // Scale strength by distance up to a point

                            p.dx += normDx * effectiveStrength;
                            p.dy += normDy * effectiveStrength;
                            isAttractedToCluster = true;
                        }
                    }
                } else {
                    // This piece is the only one left from its original player.
                    // It should probably behave like a very small regular player (e.g. seek food).
                    // Or it could just drift or have minimal random movement.
                    // For now, let it be subject to food seeking if no siblings.
                }
            }

            // Food seeking exception for pieces (applies whether parent exists or not, or if it's a lone piece)
            // This allows pieces to grab nearby food even if they are part of a non-parented cluster,
            // or if they are pieces of an existing parent.
            // This should be a weaker force than cluster cohesion if active.

            const PIECE_FOOD_SEEK_RADIUS = p.r * 4; // How far a piece will look for food
            const PIECE_FOOD_ATTRACTION_STRENGTH = 0.01; // Weaker than cluster cohesion
            let closestFood = null;
            let minDistToFood = PIECE_FOOD_SEEK_RADIUS;

            for (const f of food) {
                const distToFood = Math.hypot(p.x - f.x, p.y - f.y);
                if (distToFood < minDistToFood && distToFood > p.r * 0.5) { // Food is within seek radius and not right on top
                    minDistToFood = distToFood;
                    closestFood = f;
                }
            }

            if (closestFood) {
                const dxToFood = closestFood.x - p.x;
                const dyToFood = closestFood.y - p.y;
                // Normalized direction to food
                const normDxToFood = dxToFood / minDistToFood;
                const normDyToFood = dyToFood / minDistToFood;

                // If also attracted to cluster, food seeking is weaker.
                const actualFoodAttractionStrength = isAttractedToCluster ? PIECE_FOOD_ATTRACTION_STRENGTH * 0.5 : PIECE_FOOD_ATTRACTION_STRENGTH;

                p.dx += normDxToFood * actualFoodAttractionStrength;
                p.dy += normDyToFood * actualFoodAttractionStrength;
            }
        }

        let fleeing = false;
        let target = null;
        const forcedTarget = eatTargets[p.username];
        let targetDist = Infinity;
        let avoidingSpikes = false;

        // Spike Tree Avoidance for Small Players
        if (p.r < 50 && !p.isPiece) { // Only for small, non-piece players
            if (Math.random() < 0.75) { // 75% chance to actively try to avoid spikes
                let totalRepulsionDx = 0;
                let totalRepulsionDy = 0;
                let spikeNearby = false;

                for (const tree of spikedTrees) {
                    const distToTree = Math.hypot(p.x - tree.x, p.y - tree.y);
                    // Danger radius: tree radius + player radius + a buffer (e.g., 1.5 times player's radius, or a minimum of 50px)
                    const dangerRadius = tree.r + p.r + Math.max(p.r * 1.5, 50.0);

                    if (distToTree < dangerRadius && distToTree > 0) { // Player is in the danger zone of this tree
                        const repulsionDx = p.x - tree.x; // Vector from tree to player
                        const repulsionDy = p.y - tree.y;

                        // Normalize the repulsion vector from THIS tree
                        const normRepulsionDxFromTree = repulsionDx / distToTree;
                        const normRepulsionDyFromTree = repulsionDy / distToTree;

                        // Weight contribution by how deep into danger zone player is (stronger when closer)
                        const weight = (dangerRadius - distToTree) / dangerRadius;

                        totalRepulsionDx += normRepulsionDxFromTree * weight;
                        totalRepulsionDy += normRepulsionDyFromTree * weight;
                        spikeNearby = true;
                    }
                }

                if (spikeNearby) {
                    const magnitude = Math.hypot(totalRepulsionDx, totalRepulsionDy);
                    if (magnitude > 0) { // If there's any net repulsion force
                        const finalRepulsionDx = totalRepulsionDx / magnitude; // Normalize the summed repulsion vector
                        const finalRepulsionDy = totalRepulsionDy / magnitude;

                        const avoidanceStrength = 0.1; // Strength of the avoidance maneuver
                        p.dx += finalRepulsionDx * avoidanceStrength;
                        p.dy += finalRepulsionDy * avoidanceStrength;
                        avoidingSpikes = true; // Mark that player is actively avoiding spikes this tick
                    }
                }
            }
        }
        // End of Spike Tree Avoidance Logic

        if (avoidingSpikes) {
            target = null; // Clear any regular target if actively dodging spikes
        }

        if (forcedTarget && !avoidingSpikes) {
            const victim = players.find(x => x.username === forcedTarget);
            if (victim && victim !== p) { // Ensure victim exists and is not self
                // Scenario 1: Player 'p' can eat the 'victim'.
                if (p.r > victim.r * 1.1) {
                    const targetDx = getShortestDelta(p.x, victim.x, canvas.width);
                    const targetDy = getShortestDelta(p.y, victim.y, canvas.height);
                    const dist = Math.hypot(targetDx, targetDy);
                    if (dist > 0) {
                        target = { dx: targetDx, dy: targetDy, dist: dist };
                    } else {
                        delete eatTargets[p.username];
                    }
                }
                // Scenario 2: 'victim' can eat player 'p'. Player 'p' should not attack, and should flee.
                else if (victim.r > p.r * 1.1) {
                    delete eatTargets[p.username]; // Clear the unsafe forced attack command

                    const fleeDx = getShortestDelta(victim.x, p.x, canvas.width); // Shortest path from victim to p
                    const fleeDy = getShortestDelta(victim.y, p.y, canvas.height);
                    const fleeDist = Math.hypot(fleeDx, fleeDy);

                    if (fleeDist < 400 && fleeDist > 0) { // Threat is close
                        p.dx += (fleeDx / fleeDist) * 0.05; // Add force in direction away from victim
                        p.dy += (fleeDy / fleeDist) * 0.05;
                        fleeing = true; target = null;
                    }
                }
                else {
                    delete eatTargets[p.username]; // Command is ignored as 'p' doesn't have significant size advantage
                }
            } else {
                delete eatTargets[p.username]; // Victim not found or is self, clear command
            }
        } else if (!avoidingSpikes) {
          // --- Start of replacement block for 'else if (!avoidingSpikes)' ---
          // Player 'p' is not actively avoiding spikes. Now decide other actions.
          // Variables like 'fleeing', 'target', 'targetDist' are from the scope of the player loop.
          // 'fleeing' might have been set by spike avoidance if a large player pushed 'p' towards a spike.
          // Or it will be determined now.

          let potentialAttackTarget = null;
          let localTargetDist = Infinity; // Used to find the best individual target for player 'p' to attack

          // Step 1: Determine if player 'p' needs to flee from other players.
          // This loop also identifies the best potential individual player 'p' could attack if not fleeing.
          if (!fleeing) { // Only check for new fleeing conditions if not already fleeing (e.g. from spike interaction)
              for (const other of players) {
                  if (p === other) continue; // Skip self
                  // Prevent player 'p' from interacting with its own pieces or its original re-formed self.
                  if (p.isPiece && other.username === p.originalUsername && !other.isPiece) continue;
                  if (!p.isPiece && other.isPiece && other.originalUsername === p.username) continue;

                  const vec_p_to_other_x = getShortestDelta(p.x, other.x, canvas.width);
                  const vec_p_to_other_y = getShortestDelta(p.y, other.y, canvas.height);
                  const dist_p_to_other = Math.hypot(vec_p_to_other_x, vec_p_to_other_y);

                  if (dist_p_to_other === 0) continue; // Avoid division by zero

                  // Fleeing condition: other is bigger
                  if (other.r > p.r * 1.1 && dist_p_to_other < 400) {
                      p.dx -= (vec_p_to_other_x / dist_p_to_other) * 0.05; // Move in opposite direction of other
                      p.dy -= (vec_p_to_other_y / dist_p_to_other) * 0.05;
                      fleeing = true; target = null; potentialAttackTarget = null; break;
                  }
                  // Potential attack condition: p is bigger
                  else if (!fleeing && p.r > other.r * 1.1 && dist_p_to_other < 500 && dist_p_to_other < localTargetDist) {
                      potentialAttackTarget = { dx: vec_p_to_other_x, dy: vec_p_to_other_y, dist: dist_p_to_other };
                      localTargetDist = dist_p_to_other; // Update closest individual target
                  }
              }
          }

          // Step 2: If 'p' is a large player and not fleeing, try to find a cluster of smaller players.
          let soughtCluster = false;
          if (!fleeing && p.r >= 100 && !p.isPiece) {
              const MIN_CLUSTER_SIZE = 2; // Min players to form a notable cluster
              const CLUSTER_RADIUS_CHECK = p.r * 2.5; // Search radius around a potential cluster seed player
              const MAX_DIST_TO_CLUSTER_CENTER = p.r * 5; // Max distance 'p' will travel to a cluster's centroid
              const SMALL_PLAYER_MAX_RADIUS = p.r * 0.6; // Max radius for a player to be part of the target cluster

              let bestClusterCentroid = null;
              let maxClusterScore = 0;

              for (const potentialCenterPlayer of players) {
                  // Basic filters for a potential seed of a cluster
                  if (potentialCenterPlayer === p || potentialCenterPlayer.r >= SMALL_PLAYER_MAX_RADIUS || potentialCenterPlayer.isPiece) {
                      continue;
                  }
                  // Optimization: If potential seed player is too far to begin with, skip detailed check
                  if (Math.hypot(p.x - potentialCenterPlayer.x, p.y - potentialCenterPlayer.y) > MAX_DIST_TO_CLUSTER_CENTER + CLUSTER_RADIUS_CHECK) {
                      continue;
                  }

                  let currentClusterMembers = [];
                  let sumX = 0, sumY = 0, totalMassEquivalent = 0; // totalMassEquivalent uses radius as proxy

                  for (const memberPlayer of players) {
                      if (memberPlayer === p || memberPlayer.r >= SMALL_PLAYER_MAX_RADIUS || memberPlayer.isPiece) {
                          continue;
                      }
                      // Ensure 'p' doesn't target clusters composed of its own pieces
                      if (memberPlayer.originalUsername === p.username) continue;

                      if (Math.hypot(potentialCenterPlayer.x - memberPlayer.x, potentialCenterPlayer.y - memberPlayer.y) < CLUSTER_RADIUS_CHECK) {
                          currentClusterMembers.push(memberPlayer);
                          sumX += memberPlayer.x * memberPlayer.r;
                          sumY += memberPlayer.y * memberPlayer.r;
                          totalMassEquivalent += memberPlayer.r;
                      }
                  }

                  if (currentClusterMembers.length >= MIN_CLUSTER_SIZE && totalMassEquivalent > 0) {
                      const centroidX = sumX / totalMassEquivalent;
                      const centroidY = sumY / totalMassEquivalent;

                      const dCx = getShortestDelta(p.x, centroidX, canvas.width);
                      const dCy = getShortestDelta(p.y, centroidY, canvas.height);
                      const distToCentroid = Math.hypot(dCx, dCy);

                      if (distToCentroid < MAX_DIST_TO_CLUSTER_CENTER && distToCentroid > 1) { // Cluster is valid and reachable
                          // Score prioritizes more members, more total 'mass', and closer clusters
                          const score = (currentClusterMembers.length * totalMassEquivalent) / (distToCentroid * distToCentroid + 1);
                          if (score > maxClusterScore) {
                              maxClusterScore = score;
                              bestClusterCentroid = { dx_to_p: dCx, dy_to_p: dCy, dist: distToCentroid }; // Store the calculated shortest vector
                          }
                      }
                  }
              }

              if (bestClusterCentroid) {
                  target = { dx: bestClusterCentroid.dx_to_p, dy: bestClusterCentroid.dy_to_p, dist: bestClusterCentroid.dist };
                  soughtCluster = true;
                  potentialAttackTarget = null;
              }
          }

          // Step 3: If not fleeing, not targeting a cluster, and a potential individual attack target was found.
          if (!fleeing && !soughtCluster && potentialAttackTarget) {
              target = potentialAttackTarget;
              // targetDist (from outer scope) would ideally be updated here if it were used by subsequent logic,
              // but 'target' being set is the primary outcome.
          }

          // Step 4: If not fleeing and no other target has been set (neither cluster nor individual player), seek food.
          if (!fleeing && !target) {
              let bestFoodCluster = null;
              let bestFoodScore = 0;

              for (const f of food) {
                  const foodClusterDensityCheck = food.filter(o => {
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
                  const avgX = bestFoodCluster.reduce((sum, f) => sum + f.x, 0) / bestFoodCluster.length;
                  const avgY = bestFoodCluster.reduce((sum, f) => sum + f.y, 0) / bestFoodCluster.length;

                  const targetDx = getShortestDelta(p.x, avgX, canvas.width);
                  const targetDy = getShortestDelta(p.y, avgY, canvas.height);
                  const distToFoodCluster = Math.hypot(targetDx, targetDy);

                  if (distToFoodCluster > 1) {
                       target = { dx: targetDx, dy: targetDy, dist: distToFoodCluster };
                  }
              }
          }
          // --- End of replacement block ---
        }

        if (target && !fleeing && !avoidingSpikes && target.dist > 1) {
          const normX = target.dx / target.dist;
          const normY = target.dy / target.dist;

          // The slowdown block that was here has been removed.

          p.dx += normX * 0.015;
          p.dy += normY * 0.015;
        }

        const speed = 1 * (30 / p.r);
        p.dx = Math.max(-speed, Math.min(speed, p.dx));
        p.dy = Math.max(-speed, Math.min(speed, p.dy));

        p.x += p.dx;
        p.y += p.dy;

        p.x = (p.x + canvas.width) % canvas.width;
        p.y = (p.y + canvas.height) % canvas.height;

        // Stuck player detection and nudge
        // Check if player has moved significantly
        if (Math.hypot(p.x - p.lastPosition.x, p.y - p.lastPosition.y) < 0.1 && Math.hypot(p.dx, p.dy) < 0.1) {
            p.stagnationCounter++;
        } else {
            p.stagnationCounter = 0; // Reset if moved
        }

        p.lastPosition = { x: p.x, y: p.y };

        // If stuck for a certain number of frames, and not currently targeting something very close (or has no target)
        // And also not a piece that's meant to be stationary or controlled by strong cluster forces.
        if (p.stagnationCounter > 20) { // e.g., stuck for 20 frames (1/3 second at 60fps)
            // Check if there's an active target and if the player is very close to it.
            // 'target' variable is from the broader scope of player 'p's logic for that frame.
            // 'fleeing' is also from that scope.
            const hasValidCloseTarget = target && target.dist < p.r; // If target exists and is very close (e.g. within own radius)

            if (!hasValidCloseTarget && !fleeing && !p.isPiece) { // Don't nudge if fleeing, has a close target, or is a piece (pieces have their own group motion)
                const nudgeStrength = 0.05; // A small nudge
                p.dx += (Math.random() - 0.5) * nudgeStrength;
                p.dy += (Math.random() - 0.5) * nudgeStrength;
                p.stagnationCounter = 0; // Reset counter after nudging
            } else if (p.isPiece && p.stagnationCounter > 60) {
                // For pieces, be more lenient, but if truly stuck for long, give a tiny nudge.
                // This helps if pieces get stuck on each other in a way their cluster logic can't resolve.
                const nudgeStrength = 0.02;
                p.dx += (Math.random() - 0.5) * nudgeStrength;
                p.dy += (Math.random() - 0.5) * nudgeStrength;
                p.stagnationCounter = 0; // Reset counter
            }
        }
      }

      for (const p of players) {
        for (let i = food.length - 1; i >= 0; i--) {
          const f = food[i];
          const dx = f.x - p.x;
          const dy = f.y - p.y;
          if (Math.hypot(dx, dy) < p.r) {
            const growth = 10 / p.r;
            p.targetR += growth;
            food.splice(i, 1);
          }
        }
      }

      for (let i = players.length - 1; i >= 0; i--) {
        const p1 = players[i];
        for (let j = players.length - 1; j >= 0; j--) {
          if (i === j) continue;
          const p2 = players[j];

          if (p1.isPiece && p2.isPiece && p1.originalUsername === p2.originalUsername) {
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
                color: "white"
              });
            }

            delete eatTargets[p2.username]; // This might need more context if eatTargets is used for pieces vs full players
            if (eatTargets[p1.username] === p2.username) delete eatTargets[p1.username];

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
          score: player.r
        });
      }

      // Find unique original players from pieces in the 'players' array
      const pieceUsernames = new Set();
      players.forEach(p => {
        if (p.isPiece) {
          pieceUsernames.add(p.originalUsername);
        }
      });

      // For each original player who has pieces, find their largest piece for scoreboard
      for (const username of pieceUsernames) {
        // Only add to scoreboard if the original, non-piece player is NOT currently active
        if (!players.some(p => p.username === username && !p.isPiece)) {
          let largestPieceRadius = 0;
          let displayName = "";
          players.forEach(p => {
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
            if (!scoreboardEntries.some(e => e.username === username)) {
                 scoreboardEntries.push({
                    display_name: displayName || username,
                    username: username, // original username
                    score: largestPieceRadius
                 });
            }
          }
        }
      }

      // Sort all entries by score
      const sortedScoreboardEntries = scoreboardEntries.sort((a, b) => b.score - a.score);
      // Determine how many entries to actually show (top 20 max)
      const entriesToDisplayCount = Math.min(sortedScoreboardEntries.length, 20);

      // Draw scoreboard background with dynamic height
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(20, 20, 220, 36 + (entriesToDisplayCount * 26));

      // Draw scoreboard title
      ctx.fillStyle = "white";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🏆 Resnīši:", 30, 45);

      // Draw the top scoreboard entries
      sortedScoreboardEntries
        .slice(0, entriesToDisplayCount)
        .forEach((entry, i) => {
          ctx.fillText(`${i + 1}. ${entry.display_name} (${Math.round(entry.score)})`, 30, 70 + i * 25);
        });

      const winner = players.find(p => p.r >= 300);
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

