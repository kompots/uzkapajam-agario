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
  channels: ['uzkapajam']
});

client.connect();

client.on('message', (channel, tags, message, self) => {
  console.log(tags)
  play(tags)
  
});



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

    const NUM_SPIKED_TREES = 5;
    const SPIKED_TREE_RADIUS = 50;
    const SPIKED_TREE_RESPAWN_DELAY = 15000; // 15 seconds
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
      const spikeLength = tree.r * 0.5; // Length of the spikes
      // const spikeBaseWidth = tree.r * 0.3; // Width of the base of each spike // Not used in current spike drawing

      // Draw the main body of the tree (circle)
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fillStyle = "saddlebrown"; // Or any other tree-like color
      ctx.fill();
      ctx.strokeStyle = "darkgreen";
      ctx.lineWidth = 3;
      ctx.stroke();

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

        ctx.fillStyle = "darkolivegreen"; // Color of the spikes
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
        spawnTime: Date.now() // Can be useful for all players
      };

      const existing = players.find(p => p.username === data.username && !p.isPiece); // Ensure we don't overwrite a piece with a new player
      if (existing) Object.assign(existing, player);
      else players.push(player);
    }

    function spawnFood() {
      const margin = 40;
      while (food.length < 120) {
        food.push({
          x: Math.random() * (canvas.width - 2 * margin) + margin,
          y: Math.random() * (canvas.height - 2 * margin) + margin,
          r: 4,
          dx: (Math.random() - 0.5) * 0.3,
          dy: (Math.random() - 0.5) * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
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
          ctx.font = `10px sans-serif`;
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

          if (distance < player.r + tree.r) {
            // Collision occurred
            collidedWithTree = true;

            const numPieces = Math.max(2, Math.floor(player.r / 25)); // Ensure at least 2 pieces
            const pieceBaseRadius = player.r / numPieces; // This is a simplification, area-based would be more accurate but complex for now

            for (let k = 0; k < numPieces; k++) {
              const angle = (k / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5; // Spread pieces out
              const pieceRadius = pieceBaseRadius * (0.8 + Math.random() * 0.4); // Slight size variation

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
        if (p.isPiece) {
          const parentExists = players.some(parent => parent.username === p.originalUsername && !parent.isPiece);
          if (!parentExists) {
            const siblingPieces = players.filter(s => s.isPiece && s.originalUsername === p.originalUsername && s !== p);
            if (siblingPieces.length > 0) {
              let centroidX = 0;
              let centroidY = 0;
              let totalSiblingEffectiveMass = 0;

              for (const sibling of siblingPieces) {
                  const mass = sibling.r * sibling.r;
                  centroidX += sibling.x * mass;
                  centroidY += sibling.y * mass;
                  totalSiblingEffectiveMass += mass;
              }

              if (totalSiblingEffectiveMass > 0) {
                  centroidX /= totalSiblingEffectiveMass;
                  centroidY /= totalSiblingEffectiveMass;

                  const attractionStrength = 0.0002;
                  const dxToCentroid = centroidX - p.x;
                  const dyToCentroid = centroidY - p.y;
                  const distanceToCentroid = Math.hypot(dxToCentroid, dyToCentroid);

                  if (distanceToCentroid > p.r) {
                      p.dx += (dxToCentroid / distanceToCentroid) * attractionStrength * Math.min(distanceToCentroid, 200);
                      p.dy += (dyToCentroid / distanceToCentroid) * attractionStrength * Math.min(distanceToCentroid, 200);
                  }
              }
            }
          }
        }

        let fleeing = false;
        let target = null;
        const forcedTarget = eatTargets[p.username];
        let targetDist = Infinity;

        if (forcedTarget) {
          const victim = players.find(x => x.username === forcedTarget);
          if (victim) {
            const dx = victim.x - p.x;
            const dy = victim.y - p.y;
            const dist = Math.hypot(dx, dy);
            target = { dx, dy, dist };
          }
        } else {
          for (const other of players) {
            if (p === other) continue;
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (other.r > p.r * 1.1 && dist < 400) {
              p.dx -= (dx / dist) * 0.05;
              p.dy -= (dy / dist) * 0.05;
              fleeing = true;
            } else if (p.r > other.r * 1.1 && dist < 500 && dist < targetDist) {
              target = { dx, dy, dist };
              targetDist = dist;
            }
          }

          if (!fleeing && !target) {
            let bestCluster = null;
            let bestScore = 0;

            for (const f of food) {
              const cluster = food.filter(o => Math.hypot(f.x - o.x, f.y - o.y) < 80);
              const dist = Math.hypot(f.x - p.x, f.y - p.y);
              if (dist < 30) continue;
              const score = cluster.length / dist;

              if (score > bestScore) {
                bestScore = score;
                bestCluster = cluster;
              }
            }

            if (bestCluster && bestCluster.length > 0) {
              const avgX = bestCluster.reduce((sum, f) => sum + f.x, 0) / bestCluster.length;
              const avgY = bestCluster.reduce((sum, f) => sum + f.y, 0) / bestCluster.length;
              const dx = avgX - p.x;
              const dy = avgY - p.y;
              const dist = Math.hypot(dx, dy);
              target = { dx, dy, dist };
            }
          }
        }

        if (target && !fleeing && target.dist > 1) {
          const normX = target.dx / target.dist;
          const normY = target.dy / target.dist;

          if (target.dist < 60) {
            const correction = 0.05;
            const align = 0.7;
            p.dx = p.dx * align + normX * correction;
            p.dy = p.dy * align + normY * correction;
          }

          p.dx += normX * 0.015;
          p.dy += normY * 0.015;
        }

        const speed = 2 * (30 / p.r);
        p.dx = Math.max(-speed, Math.min(speed, p.dx));
        p.dy = Math.max(-speed, Math.min(speed, p.dy));

        p.x += p.dx;
        p.y += p.dy;

        p.x = (p.x + canvas.width) % canvas.width;
        p.y = (p.y + canvas.height) % canvas.height;


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

