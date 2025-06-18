import "./style.css";
import tmi from "tmi.js";
import axios from "axios";

const clientId = "31oc8pz2llwa1yqcb0elm85akj2wgx";
const clientSecret = "1cjzpysdytcor6f3gvb38i1q7rtr54";
const params = new URLSearchParams(window.location.search);
const channel = params.get("channel") || "uzkapajam";
const client = new tmi.Client({
  connection: {
    secure: true,
    reconnect: true,
  },
  channels: [channel],
});

const tree_img = new Image();
tree_img.crossOrigin = "anonymous";
tree_img.src = "https://i.imgur.com/i7UkBx6.png";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const winnerDiv = document.getElementById("winner");
const players = [];
const food = [];
const spikedTrees = [];
const eatTargets = {};
const particles = [];
const particles_other = [];
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
const NUM_SPIKED_TREES = 0;
const BUMP_COOLDOWN = 15000; // 10 seconds in milliseconds
const BUMP_CHARGE_SPEED = 55;
const BUMP_CHARGE_DURATION = 10000; // 2 seconds in milliseconds
const BUMP_IMPULSE = 10000; // Tunable: force applied to the target player
const RECOIL_IMPULSE = 1000; // Tunable: force applied back to the bumper
const SPIKED_TREE_RADIUS = 15;
const SPIKED_TREE_RESPAWN_DELAY = 30000;
let lastTreeRespawnTime = 0;
let gameResetting = false;

let debugPlayerListCounter = 0;
const DEBUG_PLAYER_LIST_DURATION_FRAMES = 300; // Log for ~5 seconds at 60fps

canvas.width = 1;
canvas.height = 1;

client.connect();

client.on("message", (channel, tags, message, self) => {
  message = message.replace(/@/g, "");
  if (message.includes("!eat")) {
    const player = players.find((p) => p.username === tags.username);
    if (player && player.isStopping) {
      return;
    } // Do nothing if player is stopping
    if (player && isPlayerExploded(player.master)) {
      return;
    }

    let parts = message.split(" ");
    let target = players.find((p) => p.username === parts[1]);
    if (target) {
      eatTargets[tags.username] = parts[1];
    }
    if (player) {
      player.speedBoostEndTime = Date.now() + 5000;
      player.boostActivationTime = Date.now();
    }
  } else if (message.includes("!bump")) {
    const player = players.find((p) => p.username === tags.username);
    if (player && player.isStopping) {
      return;
    }
    if (player && isPlayerExploded(player.master)) {
      return;
    }

    let parts = message.split(" ");
    let target = players.find((p) => p.username === parts[1]);
    if (target) {
      console.log(
        player.isBumping,
        Date.now() - player.lastBumpTime > BUMP_COOLDOWN,
        Date.now() - player.lastBumpTime,
        BUMP_COOLDOWN
      );
      if (
        !player.isBumping &&
        Date.now() - player.lastBumpTime > BUMP_COOLDOWN
      ) {
        player.isBumping = true;
        player.bumpTargetUsername = target.username;
        player.bumpChargeStartTime = Date.now();
        player.lastBumpTime = Date.now();
        eatTargets[tags.username] = parts[1];
        console.log(
          `${player.username} has been triggered to bump ${target.username}`
        );
      } else {
        if (player.isBumping) {
          console.log(
            `${player.username} cannot start a new bump; already bumping.`
          );
        } else {
          console.log(`${player.username} bump is on cooldown.`);
        }
      }
    }
  } else if (message === "!stop") {
    const player = players.find((p) => p.username === tags.username);
    if (player) {
      if (isPlayerExploded(player.master)) {
        return;
      }
      player.isStopping = true;
      player.isBumping = false;
      player.stopStartTime = Date.now();
      player.originalSpeedComponents = {
        dx: player.dx,
        dy: player.dy,
        currentSpeedMultiplier: player.currentSpeedMultiplier,
      };
      player.canMoveAfterStopTime = 0;
      if (player.orbitingSpikeTree) {
        const droppedTree = {
          x: player.orbitingSpikeTree.x, // Current world position of the orbiter
          y: player.orbitingSpikeTree.y,
          r: player.orbitingSpikeTree.r, // Radius of the orbiter (SPIKED_TREE_RADIUS)
          dx: (Math.random() - 0.5) / 3, // Standard dx for new environmental trees
          dy: (Math.random() - 0.5) / 3, // Standard dy for new environmental trees
          creationTime: Date.now(),
          maxLifetime: 60000, // 60 seconds in ms
          ownerMaster: player.master, // Added property
        };
        spikedTrees.push(droppedTree);
        player.orbitingSpikeTree = null;
        player.hasOrbiterSpawned = false;
        player.nextOrbiterAvailableTime = Date.now() + 5 * 60 * 1000; // 5-minute cooldown
      }
    }
    delete eatTargets[tags.username];
    // const player = players.find((p) => p.username === tags.username); // Player is already found
    if (player && player.boostActivationTime > 0) {
      player.speedBoostEndTime = Date.now();
    }
  } else if (message === "!play") {
    if (players.length < 101) {
      play(tags);
    }
  } else if (message.toLowerCase() === "!bop") {
    const player = players.find((p) => p.username === tags.username);
    if (player) {
      // Check player exists first
      if (isPlayerExploded(player.master)) {
        return;
      }
      if (player.orbitingSpikeTree) {
        // Player has an orbiter, let's drop it.
        // This logic mirrors the timed drop.

        // Create a static tree from the orbiter
        const droppedTree = {
          x: player.orbitingSpikeTree.x, // Current world position of the orbiter
          y: player.orbitingSpikeTree.y,
          r: player.orbitingSpikeTree.r, // Radius of the orbiter (SPIKED_TREE_RADIUS)
          dx: (Math.random() - 0.5) / 3, // Standard dx for new environmental trees
          dy: (Math.random() - 0.5) / 3, // Standard dy for new environmental trees
          creationTime: Date.now(),
          maxLifetime: 60000, // 60 seconds in ms
          ownerMaster: player.master, // Added property
        };
        spikedTrees.push(droppedTree);

        // Remove orbiter from player
        player.orbitingSpikeTree = null;
        player.hasOrbiterSpawned = false;

        // Set player cooldown for getting a new orbiter
        player.nextOrbiterAvailableTime = Date.now() + 5 * 60 * 1000; // 5-minute cooldown
      }
    }
  } else if (message.toLowerCase() === "!zerg") {
    const player = players.find(
      (p) => p.username === tags.username && !p.isPiece
    ); // Ensure it's the main player

    if (player) {
      // Check if player exists and is a main player
      if (isPlayerExploded(player.master)) {
        return;
      }
      if (!player.hasUsedSwarm) {
        player.hasUsedSwarm = true;
        spawnZergSwarm(player); // Call the spawning function
      }
    }
  }
});

const adjectives = [
  "Fast",
  "Silly",
  "Angry",
  "Happy",
  "Crazy",
  "Lazy",
  "Sneaky",
];
const animals = [
  "Tiger",
  "Panda",
  "Sloth",
  "Eagle",
  "Shark",
  "Llama",
  "Penguin",
];

const randomNickname = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${animal}${num}`;
};

let mockPlayers = [];
for (let i = 0; i < 10; i++) {
  mockPlayers.push(randomNickname());
}

// const mockCommands = ["!eat", "!stop", "!bop", "!zerg", "!bump"];
// const mockCommands = ["!bump"];
// mockPlayers.forEach((element, index, array) => {
//   play({
//     username: element,
//     subscriber: true,
//   });
// });

function triggerMockCommand() {
  if (players.length === 0) return;

  const randomPlayer = players[Math.floor(Math.random() * players.length)];
  const randomCommand =
    mockCommands[Math.floor(Math.random() * mockCommands.length)];

  let simulatedMessage = randomCommand;

  // Optionally include a target for !eat
  if (randomCommand === "!eat") {
    const targetPlayer = players.find(
      (p) => p.username !== randomPlayer.username
    );
    if (targetPlayer) {
      simulatedMessage += ` ${targetPlayer.username}`;
    }
  }
  if (randomCommand === "!bump") {
    const targetPlayer = players.find(
      (p) => p.username !== randomPlayer.username
    );
    if (targetPlayer) {
      simulatedMessage += ` ${targetPlayer.username}`;
    }
  }

  // Simulate the TMI 'message' event
  client.emit(
    "message",
    "#mockchannel",
    {
      username: randomPlayer.username,
      "display-name": randomPlayer.username,
      badges: {}, // Mock badges
    },
    simulatedMessage,
    false
  );
}

// setInterval(triggerMockCommand, 500);

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

async function getUserData(username, userId) {
  const token = await getAppToken();

  // Get channel ID
  const channelRes = await axios.get("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    params: {
      login: channel, // 'channel' is a global variable with the channel name
    },
  });
  const channelId = channelRes.data.data[0]?.id;

  if (!channelId) {
    console.error("Could not fetch channel ID for:", channel);
    return { profile_image_url: null };
  }

  // Get user profile picture (existing logic)
  const userProfileRes = await axios.get("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    params: {
      login: username,
    },
  });
  const profile_image_url =
    userProfileRes.data.data[0]?.profile_image_url || null;

  return { profile_image_url };
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

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

function isPlayerExploded(masterUsername) {
  if (!masterUsername) {
    // Should not happen if called correctly
    return false;
  }
  let count = 0;
  for (const p of players) {
    if (p.master === masterUsername) {
      count++;
    }
  }
  return count > 1;
}

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
  getUserData(data.username, data["user-id"]).then(({ profile_image_url }) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = profile_image_url; // Use the fetched profile image url
    let isPrivilegedByBadge =
      data.subscriber || data.mod || data.turbo ? true : false;
    let isPrivilegedByFollow = false;
    const finalIsPrivileged = !!(isPrivilegedByBadge || isPrivilegedByFollow);
    const radius = 35;
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
      master: data.username,
      spawnTime: Date.now(),
      stagnationCounter: 0,
      lastPosition: { x, y },
      speedBoostEndTime: 0,
      currentSpeedMultiplier: 1.0,
      targetSpeedMultiplier: 1.5,
      boostActivationTime: 0,
      isPrivileged: finalIsPrivileged, // Assign the combined status
      isStopping: false,
      stopStartTime: 0,
      originalSpeedComponents: { dx: 0, dy: 0, currentSpeedMultiplier: 1.0 },
      canMoveAfterStopTime: 0,
      orbitingSpikeTree: null,
      hasOrbiterSpawned: false,
      nextOrbiterAvailableTime: 0,
      hasUsedSwarm: false,
      title: data.username,
      isBumping: false,
      lastBumpTime: new Date(),
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

  // Track player velocity
  if (!p.prevX) {
    p.prevX = p.x;
    p.prevY = p.y;
  }
  p.vx = p.x - p.prevX;
  p.vy = p.y - p.prevY;
  p.prevX = p.x;
  p.prevY = p.y;

  const offsets = [-canvas.width, 0, canvas.width];
  const now = Date.now();

  // // Add smoke puff trail if attacker
  // if (!p.trail) p.trail = [];
  // if (eatTargets[p.username]) {
  //   p.trail.push({
  //     x: p.x + (Math.random() - 0.5) * 10,
  //     y: p.y + (Math.random() - 0.5) * 10,
  //     time: now,
  //     jitter: Math.random() * 4,
  //     sizeFactor: 0.5 + Math.random() * 0.5,
  //     swirlStartAngle: Math.random() * Math.PI * 2,
  //     swirlSpeed: 0.002 + Math.random() * 0.002,
  //     velBias: { x: p.vx || 0, y: p.vy || 0 },
  //   });
  //   if (p.trail.length > 40) p.trail.shift();
  // }

  // // Draw trail smoke puffs
  // if (eatTargets[p.username] && p.trail) {
  //   for (const puff of p.trail) {
  //     const age = now - puff.time;
  //     const life = 700;
  //     const alpha = Math.max(0, 1 - age / life);
  //     const radius = p.r * puff.sizeFactor * (1 + age / life);

  //     if (alpha <= 0) {
  //       if (!puff.burstDone) {
  //         const vb = puff.velBias;
  //         for (let i = 0; i < 6; i++) {
  //           const angle = Math.random() * Math.PI * 2;
  //           const speed = 0.5 + Math.random() * 1;
  //           const dirX = Math.cos(angle) * speed + vb.x * 0.3;
  //           const dirY = Math.sin(angle) * speed + vb.y * 0.3;

  //           particles_other.push({
  //             x: puff.x,
  //             y: puff.y,
  //             dx: dirX,
  //             dy: dirY,
  //             start: now,
  //             life: 500,
  //             radius: 2 + Math.random() * 2,
  //           });
  //         }
  //         puff.burstDone = true;
  //       }
  //       continue;
  //     }

  //     for (const dx_offset of offsets) {
  //       for (const dy_offset of [-canvas.height, 0, canvas.height]) {
  //         const puffX = puff.x + dx_offset;
  //         const puffY = puff.y + dy_offset;

  //         for (let i = 0; i < 3; i++) {
  //           const offsetX = (Math.random() - 0.5) * 5;
  //           const offsetY = (Math.random() - 0.5) * 5;
  //           const r = radius * (0.7 + Math.random() * 0.3);

  //           ctx.beginPath();
  //           ctx.arc(puffX + offsetX, puffY + offsetY, r, 0, Math.PI * 2);
  //           ctx.fillStyle = `rgba(180,180,180,${alpha * 0.05})`;
  //           ctx.fill();
  //         }

  //         // Swirl line
  //         const swirlAngle = puff.swirlStartAngle + age * puff.swirlSpeed;
  //         const swirlRadius = radius * 0.6;

  //         ctx.save();
  //         ctx.translate(puffX, puffY);
  //         ctx.rotate(swirlAngle);

  //         ctx.beginPath();
  //         ctx.moveTo(0, 0);
  //         for (let t = 0; t < 1; t += 0.05) {
  //           const angle = t * Math.PI * 2 * 1.5;
  //           const r = swirlRadius * t;
  //           const x = Math.cos(angle) * r;
  //           const y = Math.sin(angle) * r;
  //           ctx.lineTo(x, y);
  //         }
  //         ctx.strokeStyle = `rgba(100, 100, 100, ${alpha * 0.4})`;
  //         ctx.lineWidth = 1;
  //         ctx.stroke();
  //         ctx.restore();
  //       }
  //     }
  //   }
  // }

  // Draw the player and duplicates
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

        ctx.strokeStyle = "purple";
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
          if (p.isPrivileged === false) {
            // Explicitly check for false
            ctx.filter = "blur(4px)";
          }
          ctx.drawImage(p.avatar, drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
          if (p.isPrivileged === false) {
            // Reset filter if it was applied
            ctx.filter = "none";
          }
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
      ctx.strokeText(p.title, drawX, drawY);
      ctx.fillText(p.title, drawX, drawY);
    }
  }

  // --- BEGIN ADDITION ---
  if (p.orbitingSpikeTree) {
    // The orbitingSpikeTree object already has its x, y, and r properties updated.
    // We might need to ensure it has dx, dy if drawSpikedTree expects them, even if 0.
    // Let's assume drawSpikedTree can handle it or we provide defaults.
    const orbiterToDraw = {
      ...p.orbitingSpikeTree, // Contains x, y, r, angle
      // dx and dy for a static orbiter (in terms of its own propulsion) would be 0.
      // The drawSpikedTree function uses SPIKED_TREE_RADIUS internally for some animations,
      // so p.orbitingSpikeTree.r should be SPIKED_TREE_RADIUS.
      dx: 0,
      dy: 0,
    };

    // Call the existing drawSpikedTree function to render the orbiter.
    // The drawSpikedTree function handles drawing across canvas wrapped boundaries
    // as it draws multiple copies if near edges.
    // So, we just need to pass the primary calculated x,y.
    drawSpikedTree(orbiterToDraw);
  }
  // --- END ADDITION ---
}

function spawnZergSwarm(masterPlayer) {
  const SWARM_COUNT = 20;
  const SWARM_RADIUS = 5;
  // const SPAWN_CIRCLE_RADIUS = masterPlayer.r + 30; // This line can be removed
  const zergBaseUsername = `${masterPlayer.username}_Zerg_${Date.now()}`;

  for (let i = 0; i < SWARM_COUNT; i++) {
    // const angle = (i / SWARM_COUNT) * (Math.PI * 2); // Old logic
    // const spawnX_old = masterPlayer.x + Math.cos(angle) * SPAWN_CIRCLE_RADIUS; // Old logic
    // const spawnY_old = masterPlayer.y + Math.sin(angle) * SPAWN_CIRCLE_RADIUS; // Old logic

    let spawnX, spawnY;
    const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    const zergRadiusOffset = SWARM_RADIUS; // Use this for clarity, ensures Zerg is fully on screen

    switch (edge) {
      case 0: // Top edge
        spawnX =
          Math.random() * (canvas.width - zergRadiusOffset * 2) +
          zergRadiusOffset;
        spawnY = zergRadiusOffset;
        break;
      case 1: // Right edge
        spawnX = canvas.width - zergRadiusOffset;
        spawnY =
          Math.random() * (canvas.height - zergRadiusOffset * 2) +
          zergRadiusOffset;
        break;
      case 2: // Bottom edge
        spawnX =
          Math.random() * (canvas.width - zergRadiusOffset * 2) +
          zergRadiusOffset;
        spawnY = canvas.height - zergRadiusOffset;
        break;
      case 3: // Left edge
      default:
        spawnX = zergRadiusOffset;
        spawnY =
          Math.random() * (canvas.height - zergRadiusOffset * 2) +
          zergRadiusOffset;
        break;
    }

    const zergUsername = `${zergBaseUsername}_${i}`;

    const newZerg = {
      username: zergUsername,
      display_name: "Zerg",
      master: masterPlayer.username, // Master is the player who used !swarm
      x: (spawnX + canvas.width) % canvas.width, // Wrap initial position
      y: (spawnY + canvas.height) % canvas.height,
      dx: (Math.random() - 0.5) * 0.5, // Small initial random velocity
      dy: (Math.random() - 0.5) * 0.5,
      r: SWARM_RADIUS,
      targetR: SWARM_RADIUS,
      avatar: tree_img, // Reuse the preloaded tree_img
      isPiece: false,
      originalUsername: zergUsername, // For consistency, though not a piece from explosion

      spawnTime: Date.now(), // For general tracking, might be redundant if maxLifetime is primary
      creationTime: Date.now(), // For lifetime management
      maxLifetime: 60000, // 60 seconds

      // Standard player properties with defaults for a spawned minion
      isStopping: false,
      stopStartTime: 0,
      originalSpeedComponents: { dx: 0, dy: 0, currentSpeedMultiplier: 1.0 },
      canMoveAfterStopTime: 0,

      orbitingSpikeTree: null,
      hasOrbiterSpawned: false, // Zergs don't get orbiters
      nextOrbiterAvailableTime: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // Effectively infinite cooldown

      hasUsedSwarm: true, // Zergs cannot use !swarm

      stagnationCounter: 0,
      lastPosition: { x: spawnX, y: spawnY },
      speedBoostEndTime: 0,
      currentSpeedMultiplier: 0.4, // No initial boost from !eat mechanic
      targetSpeedMultiplier: 1.5, // Standard target for !eat
      boostActivationTime: 0,
      isPrivileged: false, // Zergs are not privileged
      title: "Zerg",
    };

    eatTargets[zergUsername] = masterPlayer.username; // Attack their master
    // No speed boost for Zerg as per user feedback (original !eat gives boostActivationTime)

    players.push(newZerg);
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

  // --- MODIFIED SPIKED TREES UPDATE & DRAW LOOP ---
  for (let i = spikedTrees.length - 1; i >= 0; i--) {
    const tree = spikedTrees[i];

    // Check for lifetime expiration for dropped orbiters (or any tree with these properties)
    if (
      tree.maxLifetime &&
      tree.creationTime &&
      Date.now() - tree.creationTime >= tree.maxLifetime
    ) {
      spikedTrees.splice(i, 1); // Remove the expired tree
      continue; // Skip further processing for this tree, it's gone
    }

    // Existing tree movement logic (if any, or add if they should move like other trees)
    // Assuming trees from `spikedTrees` array might have dx/dy for ambient movement:
    if (typeof tree.dx === "number" && typeof tree.dy === "number") {
      tree.x += tree.dx;
      tree.y += tree.dy;
      tree.x = (tree.x + canvas.width) % canvas.width;
      tree.y = (tree.y + canvas.height) % canvas.height;
    }

    // Draw the tree
    drawSpikedTree(tree);
  }
  // --- END MODIFIED LOOP ---

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

      if (distance < player.r - 10 + tree.r && player.r > 50) {
        // Standard collision criteria met

        // --- BEGIN FRIENDLY FIRE CHECK FOR DROPPED (OWNED) TREES ---
        if (tree.ownerMaster && player.master === tree.ownerMaster) {
          // This tree was dropped by an entity related to this player's master.
          // Friendly fire, so skip explosion.
          collidedWithTree = false; // Ensure this is false if we skip explosion
          continue; // Skips the explosion logic and moves to the next spikedTree
        }
        // --- END FRIENDLY FIRE CHECK FOR DROPPED (OWNED) TREES ---

        // If the check above did not 'continue', then it's a hostile collision.
        collidedWithTree = true; // This flag is part of original logic if player explodes
        // Determine number of pieces based on player size
        const R_min_for_more_pieces = 50; // Min radius to start getting more than 3 pieces
        const R_max_for_all_pieces = 300; // Radius at which player is likely to get max pieces (or close to it)
        const playerRadius = player.r; // Parent player's radius
        let sizeFactor = 0;
        if (playerRadius > R_min_for_more_pieces) {
          sizeFactor = Math.min(
            1,
            (playerRadius - R_min_for_more_pieces) /
              (R_max_for_all_pieces - R_min_for_more_pieces)
          );
        }

        let numPieces = 3 + Math.floor(sizeFactor * 7);
        const randomness = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        numPieces += randomness;
        numPieces = Math.max(3, Math.min(10, numPieces));
        debugPlayerListCounter = DEBUG_PLAYER_LIST_DURATION_FRAMES;

        const pieceRadii = [];
        if (numPieces > 0) {
          const weights = [];
          let sumOfWeights = 0;
          const MIN_WEIGHT = 0.1; // To prevent extremely small pieces, ensure a minimum proportion

          for (let i = 0; i < numPieces; i++) {
            const weight = MIN_WEIGHT + Math.random() * 0.9; // Random weight between MIN_WEIGHT and MIN_WEIGHT + 0.9
            weights.push(weight);
            sumOfWeights += weight;
          }

          for (let i = 0; i < numPieces; i++) {
            const normalizedWeight = weights[i] / sumOfWeights;
            let childRadius = Math.max(
              1.0,
              player.r * Math.sqrt(normalizedWeight)
            ); // MODIFIED line
            pieceRadii.push(childRadius);
          }
        }

        for (let k = 0; k < numPieces; k++) {
          const angle =
            (k / numPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const currentPieceRadius = pieceRadii[k];
          players.push({
            username: `${player.username}_piece_${Date.now()}_${k}`,
            display_name: player.display_name,
            x: player.x + (player.r / 2) * Math.cos(angle),
            y: player.y + (player.r / 2) * Math.sin(angle),
            dx: Math.cos(angle) * (2 + Math.random() * 2),
            dy: Math.sin(angle) * (2 + Math.random() * 2),
            r: currentPieceRadius,
            targetR: currentPieceRadius,
            avatar: player.avatar,
            isPiece: true,
            originalUsername: player.username,
            master: player.username,
            spawnTime: Date.now(),
            canMergeTime: Date.now() + 15000,
            parentPreExplosionRadius: player.r,
            master: player.master,
            title: player.title,
            isBumping: false,
            lastBumpTime: new Date(),
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
  }

  const MERGE_TIME = 30000;
  const usernamesToProcessForMerging = new Set();

  players.forEach((player) => {
    if (
      player.isPiece &&
      !player.canMergeTime &&
      Date.now() - player.spawnTime > MERGE_TIME
    ) {
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
          return a.r - b.r;
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

    // Orbiter Spawning Logic
    if (
      p.r >= 70 &&
      !p.orbitingSpikeTree &&
      !p.hasOrbiterSpawned &&
      Date.now() >= p.nextOrbiterAvailableTime
    ) {
      // Added cooldown check
      p.orbitingSpikeTree = {
        r: SPIKED_TREE_RADIUS,
        angle: Math.random() * Math.PI * 2,
        spawnTime: Date.now(), // Initialize spawnTime
        dropTimeout: Math.random() * 30000 + 30000, // Initialize random dropTimeout (30-60 seconds in ms)
        // x and y are calculated during position update phase
      };
      p.hasOrbiterSpawned = true;
      // Note: p.nextOrbiterAvailableTime is NOT reset here; it's set when an orbiter is lost/dropped.
    }
    // Orbiter Despawning Logic (if player shrinks)
    else if (p.r < 70 && !p.isPiece && p.orbitingSpikeTree) {
      // Added !p.isPiece condition
      p.orbitingSpikeTree = null;
      p.hasOrbiterSpawned = false; // Allow respawn if they grow again
    }

    if (p.orbitingSpikeTree) {
      // --- BEGIN NEW TIMED DROP LOGIC ---
      if (
        Date.now() - p.orbitingSpikeTree.spawnTime >=
        p.orbitingSpikeTree.dropTimeout
      ) {
        // Time to drop the orbiter as a static tree
        const droppedTree = {
          x: p.orbitingSpikeTree.x, // Use last calculated world position
          y: p.orbitingSpikeTree.y,
          r: p.orbitingSpikeTree.r, // Should be SPIKED_TREE_RADIUS
          dx: (Math.random() - 0.5) / 3, // Standard dx for new trees
          dy: (Math.random() - 0.5) / 3, // Standard dy for new trees
          creationTime: Date.now(),
          maxLifetime: 60000, // 60 seconds in ms
          ownerMaster: p.master, // Added property
          // Optional: isDroppedOrbiter: true, // For easier identification if needed later
        };
        spikedTrees.push(droppedTree);

        p.orbitingSpikeTree = null;
        p.hasOrbiterSpawned = false; // Allow conditions for new spawn to be checked later
        p.nextOrbiterAvailableTime = Date.now() + 5 * 60 * 1000; // 5-minute cooldown
      } // --- END NEW TIMED DROP LOGIC ---

      // Existing orbiter angle/position update logic follows here
      // (make sure it's still guarded by `if (p.orbitingSpikeTree)`)
      if (p.orbitingSpikeTree) {
        // This 'if' is crucial if the drop happened above
        p.orbitingSpikeTree.angle += 0.005;
        if (p.orbitingSpikeTree.angle > Math.PI * 2) {
          p.orbitingSpikeTree.angle -= Math.PI * 2;
        }
        const distanceToOrbiterCenter = p.r + p.orbitingSpikeTree.r;
        p.orbitingSpikeTree.x =
          p.x + Math.cos(p.orbitingSpikeTree.angle) * distanceToOrbiterCenter;
        p.orbitingSpikeTree.y =
          p.y + Math.sin(p.orbitingSpikeTree.angle) * distanceToOrbiterCenter;
        p.orbitingSpikeTree.x =
          (p.orbitingSpikeTree.x + canvas.width) % canvas.width;
        p.orbitingSpikeTree.y =
          (p.orbitingSpikeTree.y + canvas.height) % canvas.height;
      }
    }
    if (isNaN(p.x)) {
      console.log(" *** RIGHT BEFORE THE CRASH ****");
      console.log(p);
      throw new Error("ERROR");
    }
    if (p.isPiece) {
      let isUnderFreshSiblingGravitation = false;
      if (p.isPiece && p.canMergeTime && p.originalUsername) {
        let siblingSumX = 0; // Use sum for weighted average if pieces have mass, for now simple average
        let siblingSumY = 0;
        let activeSiblingsCount = 0;
        let referencePlayerForWrapping = p; // Use player p as reference for wrapped calculations

        for (const s of players) {
          if (
            s !== p &&
            s.isPiece &&
            s.originalUsername === p.originalUsername &&
            s.canMergeTime
          ) {
            // Accumulate sums based on shortest path to reference player (p) to handle wrapping
            siblingSumX +=
              referencePlayerForWrapping.x +
              getShortestDelta(referencePlayerForWrapping.x, s.x, canvas.width);
            siblingSumY +=
              referencePlayerForWrapping.y +
              getShortestDelta(
                referencePlayerForWrapping.y,
                s.y,
                canvas.height
              );
            activeSiblingsCount++;
          }
        }

        if (activeSiblingsCount > 0) {
          const targetCentroidX = siblingSumX / activeSiblingsCount;
          const targetCentroidY = siblingSumY / activeSiblingsCount;

          const vecToCentroidX = getShortestDelta(
            p.x,
            targetCentroidX,
            canvas.width
          );
          const vecToCentroidY = getShortestDelta(
            p.y,
            targetCentroidY,
            canvas.height
          );

          const distToCentroid = Math.hypot(vecToCentroidX, vecToCentroidY);

          // Tunable parameters
          const MAX_PULL_SPEED = 0.3; // Max speed component added by pull
          const PULL_ACCELERATION = 0.002; // How quickly it tries to reach pull speed towards centroid
          // Make this quite small so it's a gentle pull

          if (distToCentroid > p.r / 2) {
            // Only pull if not already very close/overlapping
            const normVecX = vecToCentroidX / distToCentroid;
            const normVecY = vecToCentroidY / distToCentroid;

            // Accelerate towards the centroid, capped by MAX_PULL_SPEED
            let pullDx = normVecX * PULL_ACCELERATION * distToCentroid;
            let pullDy = normVecY * PULL_ACCELERATION * distToCentroid;

            // Cap the pull force/speed contribution
            const currentPullSpeed = Math.hypot(pullDx, pullDy);
            if (currentPullSpeed > MAX_PULL_SPEED) {
              pullDx = (pullDx / currentPullSpeed) * MAX_PULL_SPEED;
              pullDy = (pullDy / currentPullSpeed) * MAX_PULL_SPEED;
            }

            p.dx += pullDx;
            p.dy += pullDy;
            isUnderFreshSiblingGravitation = true; // Set flag here
          }
        }
      }
      const parentExists = players.some(
        (parent) => parent.username === p.originalUsername && !parent.isPiece
      );
      let isAttractedToCluster = false;

      if (!parentExists && !isUnderFreshSiblingGravitation) {
        // MODIFIED condition
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

            const CLUSTER_ATTRACTION_STRENGTH = 0.9;
            const MIN_DISTANCE_TO_APPLY_FORCE = 1920;

            if (distanceToCentroid > MIN_DISTANCE_TO_APPLY_FORCE) {
              const normDx = dxToCentroid / distanceToCentroid;
              const normDy = dyToCentroid / distanceToCentroid;
              const effectiveStrength = 100;
              p.dx += normDx * effectiveStrength;
              p.dy += normDy * effectiveStrength;
              isAttractedToCluster = true;
            }
          }
        }
      }

      const PIECE_FOOD_SEEK_RADIUS = 0;
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
              // Check if p should NOT flee from other (because they are siblings post-delay)
              const shouldNotFleeSibling =
                p.isPiece &&
                other.isPiece &&
                p.originalUsername === other.originalUsername &&
                p.canMergeTime; // p is a spike child
              // Date.now() > p.canMergeTime; // Removed this part

              if (!shouldNotFleeSibling) {
                // If not a sibling post-delay, or other fleeing conditions met, then flee
                p.dx -= (vec_p_to_other_x / dist_p_to_other) * 0.15;
                p.dy -= (vec_p_to_other_y / dist_p_to_other) * 0.15;
                fleeing = true;
                target = null;
                potentialAttackTarget = null;
                break; // Exit the inner loop for 'other' players as we've decided to flee
              }
              // If shouldNotFleeSibling is true, we fall through and p does not flee from this 'other'.
              // It might still flee from another 'other' in a subsequent iteration.
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
    // --- BEGIN MASTER-BASED GRAVITATION ---
    if (p.master) {
      // Ensure player has a master property
      let targetX = null;
      let targetY = null;
      let foundTarget = false;

      // Try to find the main player instance of this master
      const mainPlayerTarget = players.find(
        (mp) => mp.username === p.master && !mp.isPiece
      );

      if (mainPlayerTarget && mainPlayerTarget !== p) {
        targetX = mainPlayerTarget.x;
        targetY = mainPlayerTarget.y;
        foundTarget = true;
      } else {
        // If no main player target (or p is the main player, or main player is self and p is a piece)
        // Calculate centroid of other pieces with the same master
        let siblingCount = 0;
        let sumX = 0;
        let sumY = 0;
        let referencePlayerForWrapping = p; // Use p as reference for wrapped centroid calculation

        for (const otherP of players) {
          if (otherP !== p && otherP.master === p.master) {
            // Accumulate sums based on shortest path to reference player (p) to handle wrapping for centroid
            // This is a more robust way to calculate a "wrapped centroid"
            sumX +=
              referencePlayerForWrapping.x +
              getShortestDelta(
                referencePlayerForWrapping.x,
                otherP.x,
                canvas.width
              );
            sumY +=
              referencePlayerForWrapping.y +
              getShortestDelta(
                referencePlayerForWrapping.y,
                otherP.y,
                canvas.height
              );
            siblingCount++;
          }
        }

        if (siblingCount > 0) {
          targetX = sumX / siblingCount;
          targetY = sumY / siblingCount;
          foundTarget = true;
        }
      }

      if (foundTarget) {
        const vecX = getShortestDelta(p.x, targetX, canvas.width);
        const vecY = getShortestDelta(p.y, targetY, canvas.height);
        const dist = Math.hypot(vecX, vecY);

        if (dist > 0) {
          // Avoid division by zero and no pull if already at target
          const normVecX = vecX / dist;
          const normVecY = vecY / dist;
          const MASTER_GRAVITATION_FORCE = 0.3; // Tunable constant force
          p.dx += normVecX * MASTER_GRAVITATION_FORCE;
          p.dy += normVecY * MASTER_GRAVITATION_FORCE;
        }
      }
    }
    // --- END MASTER-BASED GRAVITATION ---

    // const baseSpeed = 1 * (30 / p.r); // Original line
    const safeRadiusForSpeed = Math.max(1, p.r); // Ensure radius is at least 1 for speed calculation
    const baseSpeed = 1 * (30 / safeRadiusForSpeed); // MODIFIED line
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
    if (p.isStopping && p.canMoveAfterStopTime === 0) {
      const slowdownDuration = 1500; // 1.5 seconds
      const elapsedTime = Date.now() - p.stopStartTime;

      if (elapsedTime < slowdownDuration) {
        const slowdownFactor = 1 - elapsedTime / slowdownDuration;
        p.dx = p.originalSpeedComponents.dx * slowdownFactor;
        p.dy = p.originalSpeedComponents.dy * slowdownFactor;
        p.currentSpeedMultiplier =
          p.originalSpeedComponents.currentSpeedMultiplier * slowdownFactor;
        p.currentSpeedMultiplier = Math.max(0, p.currentSpeedMultiplier);
      } else {
        p.dx = 0;
        p.dy = 0;
        p.currentSpeedMultiplier = 0;
        p.canMoveAfterStopTime = Date.now() + 5000; // Stop for 5 seconds
      }
    } else if (
      p.isStopping &&
      p.canMoveAfterStopTime > 0 &&
      Date.now() >= p.canMoveAfterStopTime
    ) {
      // Restore speed components
      p.dx = p.originalSpeedComponents.dx;
      p.dy = p.originalSpeedComponents.dy;
      p.currentSpeedMultiplier =
        p.originalSpeedComponents.currentSpeedMultiplier;

      // Reset stopping-related flags and stored values
      p.isStopping = false;
      p.stopStartTime = 0;
      p.canMoveAfterStopTime = 0;
      p.originalSpeedComponents = { dx: 0, dy: 0, currentSpeedMultiplier: 1.0 }; // Reset to default
    }
    if (p.isPiece && p.canMergeTime && Date.now() < p.canMergeTime) {
      for (const otherP of players) {
        if (otherP === p) continue; // Don't compare with self
        if (
          otherP.isPiece &&
          otherP.canMergeTime &&
          Date.now() < otherP.canMergeTime &&
          otherP.originalUsername === p.originalUsername
        ) {
          // Calculate shortest vector between p and otherP, considering wrapping
          const deltaX = getShortestDelta(p.x, otherP.x, canvas.width);
          const deltaY = getShortestDelta(p.y, otherP.y, canvas.height);
          const distance = Math.hypot(deltaX, deltaY);
          const minDistance = p.r + otherP.r;
          if (distance < minDistance && distance > 0) {
            // distance > 0 to avoid division by zero if somehow they are at the exact same spot
            const overlap = minDistance - distance;
            // Normalize the delta vector to get direction
            const normDeltaX = deltaX / distance;
            const normDeltaY = deltaY / distance;
            // Push amount for each piece. Add a small epsilon to ensure separation.
            const pushAmount = overlap / 2 + 0.1;
            // Apply push to p (away from otherP)
            p.x -= normDeltaX * pushAmount;
            p.y -= normDeltaY * pushAmount;
            // Apply push to otherP (away from p)
            otherP.x += normDeltaX * pushAmount;
            otherP.y += normDeltaY * pushAmount;
            // It's important to handle canvas wrapping for positions AFTER direct modification
            // However, the main loop already has p.x = (p.x + canvas.width) % canvas.width;
            // This might lead to complex interactions if a push sends something far off.
            // A simpler immediate wrap after push might be better for this specific adjustment.
            p.x = (p.x + canvas.width) % canvas.width;
            p.y = (p.y + canvas.height) % canvas.height;
            otherP.x = (otherP.x + canvas.width) % canvas.width;
            otherP.y = (otherP.y + canvas.height) % canvas.height;
          }
        }
      }
    }
    // console.log(p.title, p.x, p.y);
    p.dx = isNaN(p.dx) ? 0 : p.dx;
    p.dy = isNaN(p.dy) ? 0 : p.dy;
    p.x = isNaN(p.x) ? 0 : p.x;
    p.y = isNaN(p.y) ? 0 : p.y;

    p.x += p.dx;
    p.y += p.dy;

    p.x = (p.x + canvas.width) % canvas.width;
    p.y = (p.y + canvas.height) % canvas.height;
    // console.log(p.title, p.x, p.y);
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
      if (Math.hypot(dx, dy) < p.r && !(p.isPiece && p.canMergeTime)) {
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
        p1.originalUsername === p2.originalUsername &&
        (!p1.canMergeTime || Date.now() <= p1.canMergeTime)
      ) {
        continue;
      }
      // If that 'continue' was not hit, then proceed:
      else if (
        p1.isPiece &&
        p2.isPiece &&
        p1.originalUsername === p2.originalUsername &&
        p1.canMergeTime &&
        Date.now() > p1.canMergeTime && // Check p1 has canMergeTime and its > 15s
        /* p2.canMergeTime && Date.now() > p2.canMergeTime && */ // Implicitly p2 also past its time if p1 is
        Math.hypot(p2.x - p1.x, p2.y - p1.y) < p1.r
      ) {
        // p1 must still be able to reach/touch p2

        // Sibling pieces merging, size difference not strictly required.
        // p1 absorbs p2.
        const area1 = Math.PI * p1.r * p1.r;
        const area2 = Math.PI * p2.r * p2.r;
        const newArea = area1 + area2;
        p1.targetR = Math.sqrt(newArea / Math.PI);

        // Standard particle effects for consumption
        for (let k = 0; k < 20; k++) {
          // 'k' was used in outer scope for piece creation, ensure no conflict or use different var like 'm'
          particles.push({
            x: p2.x,
            y: p2.y,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            alpha: 1,
            size: 6 + Math.random() * 4,
            color: "white", // Or a specific color for sibling merge
          });
        }

        // Remove p2 from game
        players.splice(j, 1);
        if (i > j) {
          // Adjust outer loop index if using indexed loops
          i--;
        }
        break; // p1 has eaten, break from inner loop for p2
      }

      const dx = getShortestDelta(p1.x, p2.x, canvas.width);
      const dy = getShortestDelta(p1.y, p2.y, canvas.height);
      const dist = Math.hypot(dx, dy);

      // Check for active bump collision
      if (
        p1.isBumping &&
        p1.bumpTargetUsername === p2.username &&
        dist < p1.r + p2.r &&
        dist > 0
      ) {
        // p1 is successfully bumping p2
        const normDx = dx / dist; // dx is p2.x - p1.x (shortest)
        const normDy = dy / dist; // dy is p2.y - p1.y (shortest)

        // Apply bump to target (p2)
        p2.dx += normDx * BUMP_IMPULSE;
        p2.dy += normDy * BUMP_IMPULSE;

        // Apply recoil to bumper (p1)
        p1.dx -= normDx * RECOIL_IMPULSE;
        p1.dy -= normDy * RECOIL_IMPULSE;

        // Add particle effect for bump
        for (let k = 0; k < 15; k++) {
          // k is fine here, local scope
          particles.push({
            x: p1.x + normDx * p1.r, // Approx contact point
            y: p1.y + normDy * p1.r,
            dx: (Math.random() - 0.5 + normDx) * 5, // Particles scatter generally in bump direction
            dy: (Math.random() - 0.5 + normDy) * 5,
            alpha: 1,
            size: 2 + Math.random() * 3,
            color: "rgba(255, 255, 100, 0.8)", // Yellowish for bump
          });
        }

        setTimeout(function () {
          p1.isBumping = false;
          p1.bumpTargetUsername = null;
          p1.lastBumpTime = Date.now();
        }, 10000);

        // console.log(`${p1.username} bumped ${p2.username}`);

        continue; // Skip other collision checks for this pair this frame
      }

      if (
        !p1.isPiece &&
        !p2.isPiece && // Both are main players
        dist < p1.r + p2.r &&
        dist > 0 && // They are overlapping (and not at the exact same spot)
        Math.abs(p1.r - p2.r) < 5 // Radius difference is less than 5
      ) {
        const overlap = p1.r + p2.r - dist;
        const pushAmount = overlap / 2 + 0.1; // Epsilon to ensure separation

        // Normalized direction vector from p1 to p2
        const normDx = dx / dist;
        const normDy = dy / dist;

        // Push p1 away from p2
        p1.x -= normDx * pushAmount;
        p1.y -= normDy * pushAmount;

        // Push p2 away from p1
        p2.x += normDx * pushAmount;
        p2.y += normDy * pushAmount;

        // Wrap positions
        p1.x = (p1.x + canvas.width) % canvas.width;
        p1.y = (p1.y + canvas.height) % canvas.height;
        p2.x = (p2.x + canvas.width) % canvas.width;
        p2.y = (p2.y + canvas.height) % canvas.height;

        // Potentially add slight bounce effect by reversing some velocity?
        // For now, just separation. We can enhance later if needed.
        // This 'continue' will skip the eating logic below for this pair
        continue;
      }

      if (
        dist < p1.r &&
        p1.r > p2.r * 1.1 &&
        !(
          !p1.isPiece &&
          p2.isPiece &&
          p2.originalUsername === p1.username &&
          (p2.canMergeTime
            ? Date.now() > p2.canMergeTime
            : Date.now() - p2.spawnTime > MERGE_TIME)
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
        (p2.canMergeTime
          ? Date.now() > p2.canMergeTime
          : Date.now() - p2.spawnTime > MERGE_TIME) &&
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

  // Final survivor reformation logic
  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    if (!p) continue; // Player might have been removed in this frame

    if (
      p.isPiece &&
      typeof p.parentPreExplosionRadius !== "undefined" &&
      p.originalUsername
    ) {
      let isLastSurvivor = true;
      for (const other of players) {
        if (
          other !== p &&
          other.isPiece &&
          other.originalUsername === p.originalUsername &&
          typeof other.parentPreExplosionRadius !== "undefined" &&
          other.parentPreExplosionRadius === p.parentPreExplosionRadius
        ) {
          isLastSurvivor = false;
          break;
        }
      }

      if (isLastSurvivor) {
        const oldPieceUsername = p.username; // For logging. Note: p.username was the piece's unique ID here.
        p.username = p.originalUsername; // Now p.username is the original Twitch username.
        delete p.canMergeTime;
        delete p.parentPreExplosionRadius;
        p.dx = 0;
        p.dy = 0;
      }
    }
  }

  // --- BEGIN ZERG (AND OTHER TIMED PLAYER) LIFETIME CLEANUP ---
  for (let i = players.length - 1; i >= 0; i--) {
    const p = players[i];
    // Check for lifetime expiration for players that have these properties (e.g., Zergs)
    if (
      p.maxLifetime &&
      p.creationTime &&
      Date.now() - p.creationTime >= p.maxLifetime
    ) {
      // Remove the expired player (Zerg)
      // Also remove its eatTarget entry if it exists
      if (eatTargets[p.username]) {
        delete eatTargets[p.username];
      }
      players.splice(i, 1);
    }
  }
  // --- END ZERG (AND OTHER TIMED PLAYER) LIFETIME CLEANUP ---

  players.sort((a, b) => a.r - b.r);
  for (const p of players) {
    if (!isNaN(p.dx) && !isNaN(p.dy)) {
      drawPlayer(p);
    }
  }

  drawParticles();
  spawnFood();

  const scoreboardEntries = [];
  players.forEach((p) => {
    if (
      !p.isPiece &&
      !p.username.includes("_piece") &&
      !p.username.includes("Zerg")
    ) {
      scoreboardEntries.push({
        display_name: p.display_name,
        username: p.username,
        score: Math.round(Math.floor(p.r)),
      });
    }
  });

  const sortedScoreboardEntries = scoreboardEntries.sort(
    (a, b) => b.score - a.score
  );
  const entriesToDisplayCount = Math.min(sortedScoreboardEntries.length, 20);

  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";

  // Measure the longest entry width
  let maxTextWidth = ctx.measureText("🏆 Resnīši (R) / 300").width;

  sortedScoreboardEntries
    .slice(0, entriesToDisplayCount)
    .forEach((entry, i) => {
      const text = `${i + 1}. ${entry.display_name} (${Math.round(
        entry.score
      )})`;
      const width = ctx.measureText(text).width;
      if (width > maxTextWidth) maxTextWidth = width;
    });

  const padding = 20;
  const boxX = 20;
  const boxY = 20;
  const boxWidth = maxTextWidth + padding * 2;
  const boxHeight = 36 + entriesToDisplayCount * 26;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = "white";
  ctx.fillText("🏆 Resnīši (R) / 300", boxX + padding, 45);

  sortedScoreboardEntries
    .slice(0, entriesToDisplayCount)
    .forEach((entry, i) => {
      ctx.fillText(
        `${i + 1}. ${entry.display_name} (${Math.round(entry.score)})`,
        boxX + padding,
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

  // if (debugPlayerListCounter > 0) {
  //   console.log(
  //     `--- Player List Snapshot (Frames remaining to log: ${debugPlayerListCounter}) ---`
  //   );
  //   if (players.length === 0) {
  //     console.log("Player list is empty.");
  //   } else {
  //     players.forEach((p_diag, index) => {
  //       let diagInfo = `#${index} - User: "${p_diag.username}", Piece: ${
  //         p_diag.isPiece
  //       }, R: ${p_diag.r.toFixed(2)}, mass: ${Math.round(p_diag.r * p_diag.r)}`;
  //       if (p_diag.isPiece) {
  //         diagInfo += `, OrigUser: "${p_diag.originalUsername || "N/A"}"`;
  //         if (typeof p_diag.parentPreExplosionRadius !== "undefined") {
  //           diagInfo += `, parentR: ${p_diag.parentPreExplosionRadius.toFixed(
  //             2
  //           )}`;
  //         }
  //         if (typeof p_diag.canMergeTime !== "undefined") {
  //           const mergeTimeDelta = (p_diag.canMergeTime - Date.now()) / 1000;
  //           diagInfo += `, mergeIn: ${mergeTimeDelta.toFixed(1)}s`;
  //         } else {
  //           diagInfo += `, canMergeTime: N/A`;
  //         }
  //       }
  //       console.log(diagInfo);
  //     });
  //   }
  //   console.log(`--- End Snapshot (Total players: ${players.length}) ---`);
  //   debugPlayerListCounter--;
  //   if (debugPlayerListCounter === 0) {
  //     console.log("Player list logging deactivated.");
  //   }
  // }
  requestAnimationFrame(animate);
}

resizeCanvas();
spawnSpikedTrees();
animate();
