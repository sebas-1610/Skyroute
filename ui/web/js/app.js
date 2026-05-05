/**
 * SkyRoute Canvas Network Animation
 */
(function() {
    'use strict';

    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const AMBER  = 'oklch(76% 0.175 65)';
    const TEAL   = 'oklch(70% 0.13 190)';
    const CORAL  = 'oklch(68% 0.17 25)';

    const C_AMBER  = '#d4870a';
    const C_TEAL   = '#2abfa0';
    const C_CORAL  = '#d4634a';
    const C_LINE   = 'rgba(210, 190, 140, 0.18)';
    const C_PACKET = 'rgba(210, 190, 140, 0.7)';

    const NODE_COUNT = 28;
    let nodes = [];
    let packets = [];

    function resize() {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function initNodes() {
        nodes = [];
        const w = canvas.width;
        const h = canvas.height;
        for (let i = 0; i < NODE_COUNT; i++) {
            const isHub = Math.random() < 0.2;
            nodes.push({
                x:  Math.random() * w,
                y:  Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r:  isHub ? 5 : (Math.random() * 2.5 + 1.5),
                hub: isHub,
                color: isHub ? C_CORAL : (Math.random() < 0.4 ? C_TEAL : C_AMBER),
            });
        }
    }

    function spawnPacket(a, b) {
        packets.push({ a, b, t: 0, speed: 0.004 + Math.random() * 0.004 });
    }

    function tick() {
        const w = canvas.width;
        const h = canvas.height;
        const maxDist = Math.min(w, h) * 0.30;

        ctx.clearRect(0, 0, w, h);

        nodes.forEach(n => {
            n.x += n.vx; n.y += n.vy;
            if (n.x < 0 || n.x > w) n.vx *= -1;
            if (n.y < 0 || n.y > h) n.vy *= -1;
        });

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d  = Math.sqrt(dx*dx + dy*dy);
                if (d < maxDist) {
                    const alpha = (1 - d / maxDist) * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(180, 160, 110, ${alpha})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();

                    if (Math.random() < 0.0008) spawnPacket(i, j);
                }
            }
        }

        nodes.forEach(n => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.globalAlpha = n.hub ? 0.9 : 0.6;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (n.hub) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
                ctx.strokeStyle = C_CORAL;
                ctx.lineWidth = 0.8;
                ctx.globalAlpha = 0.3;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });

        packets = packets.filter(p => {
            p.t += p.speed;
            if (p.t >= 1) return false;
            const a = nodes[p.a], b = nodes[p.b];
            const x = a.x + (b.x - a.x) * p.t;
            const y = a.y + (b.y - a.y) * p.t;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = C_PACKET;
            ctx.fill();
            return true;
        });

        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', () => { resize(); initNodes(); });
    resize();
    initNodes();
    tick();
})();