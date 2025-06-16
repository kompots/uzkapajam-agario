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
  channels: ['sodapoppin']
});

client.connect();

client.on('message', (channel, tags, message, self) => {
  let cmds = ["!play"]
  message = cmds[Math.floor(Math.random() * cmds.length)];
  console.log("Executed : ", message , " for ", tags.username)
    if (message.includes("!eat")) {
      let parts = message.split(' ');
      parts[1] = players[Math.floor(Math.random() * players.length)]
      eatTargets[tags.username] = parts[1];
    } else if (message === "!stop") {
      delete eatTargets[tags.username];
    }
    else if (message === "!play") {
      play(tags)
    }
});



    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const winnerDiv = document.getElementById("winner");
    canvas.width = 1;
    canvas.height = 1;

    const players = [];
    const food = [];
    const eatTargets = {};
    const particles = [];
    const colors = ["red", "blue", "green", "yellow", "orange", "purple", "lime", "cyan"];
    let gameResetting = false;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

  async function play(data) {
    getUserProfilePicture(data.username).then((avatar_url) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = avatar_url
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
          avatar: img
        };

        const existing = players.find(p => p.username === data.username);
        if (!existing) {
          players.push(player);
        }
      });      
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

    function isImageBroken(img) {
      return !img.complete || img.naturalWidth === 0;
    }

    function drawPlayer(p) {
      p.r += (p.targetR - p.r) * 0.15;

      const offsets = [-canvas.width, 0, canvas.width];
      for (const dx of offsets) {
        for (const dy of [-canvas.height, 0, canvas.height]) {
          const drawX = p.x + dx;
          const drawY = p.y + dy;

          ctx.beginPath();
          ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "grey";
          ctx.stroke();

          ctx.save();
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
          ctx.clip();
          if (!isImageBroken(p.avatar)) {
            ctx.drawImage(p.avatar, drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
          }

          // Create radial gradient for blur-like mask
          const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.r);
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");     // Center: no blur
          gradient.addColorStop(0.7, "rgba(0, 0, 0, 0)");   // Mid-radius: no blur
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");   // Edge: soft darkening

          ctx.fillStyle = gradient;
          ctx.fillRect(drawX - p.r, drawY - p.r, p.r * 2, p.r * 2);
          ctx.restore();

          ctx.fillStyle = "white";
          ctx.font = `${p.r/3}px sans-serif`;
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


      for (const f of food) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
      }

      for (const p of players) {
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
            const correction = 1;
            const align = 0.7;
            p.dx = p.dx * align + normX * correction;
            p.dy = p.dy * align + normY * correction;
          }

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
        for (const p2 of players) {
          if (p1 === p2) continue;
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

            delete eatTargets[p2.username];
            if (eatTargets[p1.username] === p2.username) delete eatTargets[p1.username];
            players.splice(players.indexOf(p2), 1);
            break;
          }
        }
      }

      players.sort((a, b) => a.r - b.r);
      for (const p of players) drawPlayer(p);

      drawParticles();
      spawnFood();

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(20, 20, 220, `${36 + ((players.length > 20 ? 20 : players.length) * 26)}`);
      ctx.fillStyle = "white";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🏆 Resnīši:", 30, 45);

      players
        .slice()
        .sort((a, b) => b.r - a.r)
        .slice(0, 20)
        .forEach((p, i) => {
          ctx.fillText(`${i + 1}. ${p.display_name} (${Math.round(p.r)})`, 30, 70 + i * 25);
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

    animate();

