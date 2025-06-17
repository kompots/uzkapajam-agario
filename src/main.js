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
    const player = players.find((p) => p.username === tags.username);
    if (player) {
      player.speedBoostEndTime = Date.now() + 5000;
      player.boostActivationTime = Date.now();
    }
  } else if (message === "!stop") {
    delete eatTargets[tags.username];
    const player = players.find((p) => p.username === tags.username);
    if (player && player.boostActivationTime > 0) {
      player.speedBoostEndTime = Date.now();
    }
  } else if (message === "!play") {
    play(tags);
  }
  if (players.length < 101) {
    play(tags);
  }
  if (Math.floor(Math.random() * 10) + 1 > 7) {
    if (players.length > 2) {
      let target = players[Math.floor(Math.random() * players.length)].username;
      eatTargets[tags.username] = target;
      console.log("Triggered attack on : ", target);
    }
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

function getShortestDelta(coord1, coord2, maxCoord) {
  const directDelta = coord2 - coord1;
  const wrappedDelta1 = coord2 + maxCoord - coord1;
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
const SPIKED_TREE_RESPAWN_DELAY = 30000;
let lastTreeRespawnTime = 0;

function trySpawnOneSpikedTree() {
  if (spikedTrees.length >= NUM_SPIKED_TREES) return false;

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
    if (safe) {
      safe = !players.some(
        (p) => Math.hypot(p.x - x, p.y - y) < p.r + SPIKED_TREE_RADIUS + 20
      );
    }
    if (safe) {
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
      dx: (Math.random() - 0.5) / 3,
      dy: (Math.random() - 0.5) / 3,
    });
    return true;
  }
  return false;
}

function spawnSpikedTrees() {
  const margin = SPIKED_TREE_RADIUS * 2;
  while (spikedTrees.length < NUM_SPIKED_TREES) {
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
    }
    if (safe) {
      spikedTrees.push({
        x,
        y,
        r: SPIKED_TREE_RADIUS,
        dx: (Math.random() - 0.5) / 3,
        dy: (Math.random() - 0.5) / 3,
      });
    } else {
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
  const baseRadius = SPIKED_TREE_RADIUS;
  const animationSpeed = 1500;
  const scaleFactor = 0.2;

  const currentScale =
    (Math.sin(Date.now() / (animationSpeed / (2 * Math.PI))) + 1) / 2;

  tree.r = baseRadius + baseRadius * scaleFactor * currentScale;

  const numSpikes = 12;
  const spikeLength = tree.r * 0.3;

  ctx.beginPath();
  ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
  ctx.fillStyle = "black";
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

  for (let i = 0; i < numSpikes; i++) {
    const angle = (i / numSpikes) * Math.PI * 2;

    const outerPointX = tree.x + Math.cos(angle) * (tree.r + spikeLength * 1.5);
    const outerPointY = tree.y + Math.sin(angle) * (tree.r + spikeLength * 1.5);

    const baseAngleOffset = (Math.PI / numSpikes) * 0.5;

    const point1X = tree.x + Math.cos(angle - baseAngleOffset) * tree.r;
    const point1Y = tree.y + Math.sin(angle - baseAngleOffset) * tree.r;

    const point2X = tree.x + Math.cos(angle + baseAngleOffset) * tree.r;
    const point2Y = tree.y + Math.sin(angle + baseAngleOffset) * tree.r;

    ctx.beginPath();
    ctx.moveTo(outerPointX, outerPointY);
    ctx.lineTo(point1X, point1Y);
    ctx.lineTo(point2X, point2Y);
    ctx.closePath();

    ctx.fillStyle = "purple";
    ctx.fill();
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
      isPiece: false,
      originalUsername: data.username,
      spawnTime: Date.now(),
      stagnationCounter: 0,
      lastPosition: { x, y },
      speedBoostEndTime: 0,
      currentSpeedMultiplier: 1.0,
      targetSpeedMultiplier: 1.5,
      boostActivationTime: 0,
    };

    const existing = players.find(
      (p) => p.username === data.username && !p.isPiece
    );
    if (!existing) {
      players.push(player);
    }
  });
}

function spawnFood() {
  const foodSpawnMargin = 4;
  let attemptsToSpawn = 0;

  while (food.length < 120 && attemptsToSpawn < 200) {
    let foodRadius = Math.floor(Math.random() * 9) + 2;
    attemptsToSpawn++;
    let x,
      y,
      safeToSpawn = false;
    let placementAttempts = 0;

    while (!safeToSpawn && placementAttempts < 10) {
      placementAttempts++;
      x =
        Math.random() * (canvas.width - 2 * foodSpawnMargin) + foodSpawnMargin;
      y =
        Math.random() * (canvas.height - 2 * foodSpawnMargin) + foodSpawnMargin;
      safeToSpawn = true;

      for (const tree of spikedTrees) {
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
  p.r += (p.targetR - p.r) * 0.15;

  const offsets = [-canvas.width, 0, canvas.width];
  for (const dx_offset of offsets) {
    for (const dy_offset of [-canvas.height, 0, canvas.height]) {
      const drawX = p.x + dx_offset;
      const drawY = p.y + dy_offset;

      ctx.beginPath();
      ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);

      const isAttacker = eatTargets[p.username];
      let currentLineWidth = 1;

      if (isAttacker) {
        const animationSpeed = 1000;
        const pulsationFactor =
          (Math.sin(Date.now() / (animationSpeed / (2 * Math.PI))) + 1) / 2;

        ctx.strokeStyle = "red";
        currentLineWidth = 3 + pulsationFactor * 3;
        ctx.lineWidth = currentLineWidth;
      } else if (p.isPiece) {
        ctx.strokeStyle = "rgba(200, 200, 200, 0.7)";
        currentLineWidth = 1.5;
        ctx.lineWidth = currentLineWidth;
      } else {
        ctx.strokeStyle = "grey";
        currentLineWidth = 1;
        ctx.lineWidth = currentLineWidth;
      }
      ctx.stroke();

      if (isAttacker) {
        const animationSpeed = 1000;
        const pulsationFactor =
          (Math.sin(Date.now() / (animationSpeed / (2 * Math.PI))) + 1) / 2;
        const baseAlpha = 0.3;
        const pulseAlpha = 0.4 * pulsationFactor;

        const attackerGradient = ctx.createRadialGradient(
          drawX,
          drawY,
          0,
          drawX,
          drawY,
          p.r
        );
        attackerGradient.addColorStop(
          0,
          `rgba(255, 0, 0, ${baseAlpha + pulseAlpha / 2})`
        );
        attackerGradient.addColorStop(
          0.7,
          `rgba(255, 0, 0, ${baseAlpha + pulseAlpha})`
        );
        attackerGradient.addColorStop(1, `rgba(200, 0, 0, ${baseAlpha})`);

        ctx.fillStyle = attackerGradient;
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
      ctx.clip();

      if (p.avatar && p.avatar.complete && p.avatar.naturalHeight !== 0) {
        try {
          ctx.drawImage(p.avatar, drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
        } catch (e) {
          ctx.fillStyle = p.isPiece
            ? "rgba(120,120,120,0.5)"
            : "rgba(80,80,80,0.6)";
          ctx.fill();
        }
      } else {
        ctx.fillStyle = p.isPiece
          ? "rgba(120,120,120,0.5)"
          : "rgba(80,80,80,0.6)";
        ctx.fill();
      }

      const originalGradient = ctx.createRadialGradient(
        drawX,
        drawY,
        0,
        drawX,
        drawY,
        p.r
      );
      originalGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      originalGradient.addColorStop(0.7, "rgba(0, 0, 0, 0)");
      originalGradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");

      ctx.fillStyle = originalGradient;
      ctx.fillRect(drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
      ctx.restore();

      ctx.fillStyle = "white";
      ctx.font = `${p.r / 3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = currentLineWidth + 2.5;
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

  for (const f of food) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  for (const tree of spikedTrees) {
    tree.x += tree.dx;
    tree.y += tree.dy;

    tree.x = (tree.x + canvas.width) % canvas.width;
    tree.y = (tree.y + canvas.height) % canvas.height;

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

  for (let i = players.length - 1; i >= 0; i--) {
    const player = players[i];
    let collidedWithTree = false;

    for (let j = spikedTrees.length - 1; j >= 0; j--) {
      const tree = spikedTrees[j];
      const dx = player.x - tree.x;
      const dy = player.y - tree.y;
      const distance = Math.hypot(dx, dy);

      if (distance < player.r / 3 + tree.r && player.r > 50) {
        collidedWithTree = true;

        const numPieces = Math.max(2, Math.floor(player.r / 25));
        const pieceBaseRadius = player.r / numPieces;

        for (let k = 0; k < numPieces; k++) {
          const angle =
            (k / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const pieceRadius = pieceBaseRadius * (0.8 + Math.random() * 0.65);

          players.push({
            username: `${player.username}_piece_${Date.now()}_${k}`,
            display_name: player.display_name,
            x: player.x + (player.r / 2) * Math.cos(angle),
            y: player.y + (player.r / 2) * Math.sin(angle),
            dx: Math.cos(angle) * (2 + Math.random() * 2),
            dy: Math.sin(angle) * (2 + Math.random() * 2),
            r: pieceRadius,
            targetR: pieceRadius,
            avatar: player.avatar,
            isPiece: true,
            originalUsername: player.username,
            spawnTime: Date.now(),
          });
        }

        players.splice(i, 1);

        spikedTrees.splice(j, 1);

        for (let k = 0; k < 30; k++) {
          particles.push({
            x: player.x,
            y: player.y,
            dx: (Math.random() - 0.5) * 8,
            dy: (Math.random() - 0.5) * 8,
            alpha: 1,
            size: 3 + Math.random() * 3,
            color: "orange",
          });
        }

        break;
      }
    }
    if (collidedWithTree) {
    }
  }

  const MERGE_TIME = 15000;
  const usernamesToProcessForMerging = new Set();

  players.forEach((player) => {
    if (player.isPiece && Date.now() - player.spawnTime > MERGE_TIME) {
      usernamesToProcessForMerging.add(player.originalUsername);
    }
  });

  for (const username of usernamesToProcessForMerging) {
    const originalPlayerActive = players.some(
      (p) => p.username === username && !p.isPiece
    );

    if (originalPlayerActive) {
      for (let i = players.length - 1; i >= 0; i--) {
        if (
          players[i].isPiece &&
          players[i].originalUsername === username &&
          Date.now() - players[i].spawnTime > MERGE_TIME
        ) {
          players.splice(i, 1);
        }
      }
      continue;
    }

    let primaryPlayer = players.find(
      (p) => p.username === username && !p.isPiece
    );
    const userPieces = players.filter(
      (p) =>
        p.isPiece &&
        p.originalUsername === username &&
        Date.now() - p.spawnTime > MERGE_TIME
    );

    if (!primaryPlayer && userPieces.length > 0) {
      userPieces.sort((a, b) => {
        if (b.r !== a.r) {
          return b.r - a.r;
        }
        return a.spawnTime - b.spawnTime;
      });

      primaryPlayer = userPieces[0];
      primaryPlayer.isPiece = false;
      primaryPlayer.username = primaryPlayer.originalUsername;
    }
  }

  for (const p of players) {
    if (typeof p.stagnationCounter === "undefined") {
      p.stagnationCounter = 0;
    }
    if (typeof p.lastPosition === "undefined") {
      p.lastPosition = { x: p.x, y: p.y };
    }

    if (p.isPiece) {
      const parentExists = players.some(
        (parent) => parent.username === p.originalUsername && !parent.isPiece
      );
      let isAttractedToCluster = false;

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
            const mass = sibling.r * sibling.r;
            centroidX += sibling.x * mass;
            centroidY += sibling.y * mass;
            totalSiblingEffectiveMass += mass;
          }

          if (totalSiblingEffectiveMass > 0) {
            centroidX /= totalSiblingEffectiveMass;
            centroidY /= totalSiblingEffectiveMass;

            const dxToCentroid = getShortestDelta(p.x, centroidX, canvas.width);
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

    let fleeing = false;
    let target = null;
    let avoidingSpikes = false;
    const forcedTargetUsername = eatTargets[p.username];
    let isPursuingForcedTarget = false;

    if (forcedTargetUsername) {
      const victim = players.find((x) => x.username === forcedTargetUsername);
      if (victim && victim !== p) {
        const targetDx = getShortestDelta(p.x, victim.x, canvas.width);
        const targetDy = getShortestDelta(p.y, victim.y, canvas.height);
        const dist = Math.hypot(targetDx, targetDy);

        if (dist > 0) {
          target = { dx: targetDx, dy: targetDy, dist: dist };
          isPursuingForcedTarget = true;
          fleeing = false;
        } else {
          delete eatTargets[p.username];
        }
      } else {
        delete eatTargets[p.username];
      }
    }

    if (!isPursuingForcedTarget) {
      if (!p.isPiece && Math.random() < 0.75) {
        let totalRepulsionDx = 0;
        let totalRepulsionDy = 0;
        let spikeNearby = false;

        for (const tree of spikedTrees) {
          const distToTree = Math.hypot(p.x - tree.x, p.y - tree.y);
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
            const avoidanceStrength = Math.max(0.15 - p.r / 1000, 0.02);

            p.dx += finalRepulsionDx * avoidanceStrength;
            p.dy += finalRepulsionDy * avoidanceStrength;

            avoidingSpikes = true;
            target = null;
          }
        }
      }

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
              target = { dx: targetDx, dy: targetDy, dist: distToFoodCluster };
            }
          }
        }
      }
    }

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

    const baseSpeed = 1 * (30 / p.r);
    let actualSpeed = baseSpeed;
    const rampTime = 1000;

    if (p.boostActivationTime > 0) {
      const currentTime = Date.now();
      if (currentTime < p.speedBoostEndTime) {
        const elapsedSinceActivation = currentTime - p.boostActivationTime;
        if (elapsedSinceActivation < rampTime) {
          p.currentSpeedMultiplier =
            1.0 +
            (p.targetSpeedMultiplier - 1.0) *
              (elapsedSinceActivation / rampTime);
        } else {
          p.currentSpeedMultiplier = p.targetSpeedMultiplier;
        }
      } else {
        const timeSinceBoostShouldHaveEnded = currentTime - p.speedBoostEndTime;
        if (
          timeSinceBoostShouldHaveEnded < rampTime &&
          p.currentSpeedMultiplier > 1.0
        ) {
          p.currentSpeedMultiplier =
            p.targetSpeedMultiplier -
            (p.targetSpeedMultiplier - 1.0) *
              (timeSinceBoostShouldHaveEnded / rampTime);
          p.currentSpeedMultiplier = Math.max(1.0, p.currentSpeedMultiplier);
        } else {
          p.currentSpeedMultiplier = 1.0;
          p.boostActivationTime = 0;
          p.speedBoostEndTime = 0;
        }
      }
    } else {
      p.currentSpeedMultiplier = 1.0;
      p.boostActivationTime = 0;
      p.speedBoostEndTime = 0;
    }

    actualSpeed = baseSpeed * p.currentSpeedMultiplier;
    p.dx = Math.max(-actualSpeed, Math.min(actualSpeed, p.dx));
    p.dy = Math.max(-actualSpeed, Math.min(actualSpeed, p.dy));

    p.x += p.dx;
    p.y += p.dy;

    p.x = (p.x + canvas.width) % canvas.width;
    p.y = (p.y + canvas.height) % canvas.height;

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
        const nudgeStrength = 0.02;
        p.dx += (Math.random() - 0.5) * nudgeStrength;
        p.dy += (Math.random() - 0.5) * nudgeStrength;
        p.stagnationCounter = 0;
      }
    }
  }

  for (const p of players) {
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i];
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      if (Math.hypot(dx, dy) < p.r) {
        const growth = (f.r * 2) / p.r;
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

      if (
        dist < p1.r &&
        p1.r > p2.r * 1.1 &&
        !(
          !p1.isPiece &&
          p2.isPiece &&
          p2.originalUsername === p1.username &&
          Date.now() - p2.spawnTime > MERGE_TIME
        )
      ) {
        const area1 = Math.PI * p1.r * p1.r;
        const area2 = Math.PI * p2.r * p2.r;
        const newArea = area1 + area2;
        p1.targetR = Math.sqrt(newArea / Math.PI);

        if (
          eatTargets[p1.username] === p2.username &&
          p1.boostActivationTime > 0
        ) {
          p1.speedBoostEndTime = Date.now();
        }
        if (p2.boostActivationTime > 0) {
          p2.speedBoostEndTime = Date.now();
          p2.currentSpeedMultiplier = 1.0;
        }

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

        delete eatTargets[p2.username];
        if (eatTargets[p1.username] === p2.username)
          delete eatTargets[p1.username];

        players.splice(j, 1);
        if (i > j) {
          i--;
        }
        break;
      } else if (
        !p1.isPiece &&
        p2.isPiece &&
        p2.originalUsername === p1.username &&
        Date.now() - p2.spawnTime > MERGE_TIME &&
        dist < p1.r
      ) {
        const area1 = Math.PI * p1.r * p1.r;
        const area2 = Math.PI * p2.r * p2.r;
        const newArea = area1 + area2;
        p1.targetR = Math.sqrt(newArea / Math.PI);

        for (let k = 0; k < 15; k++) {
          particles.push({
            x: p2.x,
            y: p2.y,
            dx: (Math.random() - 0.5) * 3,
            dy: (Math.random() - 0.5) * 3,
            alpha: 1,
            size: 4 + Math.random() * 3,
            color: "lightblue",
          });
        }

        players.splice(j, 1);
        if (i > j) {
          i--;
        }
      }
    }
  }

  players.sort((a, b) => a.r - b.r);
  for (const p of players) drawPlayer(p);

  drawParticles();
  spawnFood();

  const scoreboardEntries = [];

  for (const player of players) {
    scoreboardEntries.push({
      display_name: player.display_name,
      username: player.username,
      score: player.r,
    });
  }

  const pieceUsernames = new Set();
  players.forEach((p) => {
    if (p.isPiece) {
      pieceUsernames.add(p.originalUsername);
    }
  });

  for (const username of pieceUsernames) {
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
        if (!scoreboardEntries.some((e) => e.username === username)) {
          scoreboardEntries.push({
            display_name: displayName || username,
            username: username,
            score: largestPieceRadius,
          });
        }
      }
    }
  }

  const sortedScoreboardEntries = scoreboardEntries.sort(
    (a, b) => b.score - a.score
  );
  const entriesToDisplayCount = Math.min(sortedScoreboardEntries.length, 20);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(20, 20, 220, 36 + entriesToDisplayCount * 26);

  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("🏆 Resnīši:", 30, 45);

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

resizeCanvas();
spawnSpikedTrees();
animate();
