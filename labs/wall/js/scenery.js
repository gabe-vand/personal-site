// Scenery at either end of the wall: the kickboard, crash pads and a chalk bucket at the bottom;
// the rubber lip, the top-out deck and the gym ceiling with its lamps at the top.
import { shade } from './rng.js';

export function drawFloor(ctx, view, layout) {
    const { X, Y, s, camY } = view;
    if (camY > 40) return;
    const vw = layout.vw;
    ctx.fillStyle = '#c7a878';                       // kickboard
    ctx.fillRect(0, Y(22), vw, 22 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, Y(22), vw, Math.max(1, s));
    const g = ctx.createLinearGradient(0, Y(0), 0, Y(-40));   // pad top, seen at a steep angle
    g.addColorStop(0, '#263a63');
    g.addColorStop(1, '#34518a');
    ctx.fillStyle = g;
    ctx.fillRect(0, Y(0), vw, 40 * s);
    ctx.fillStyle = '#1b2946';                       // pad front face
    ctx.fillRect(0, Y(-40), vw, 34 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, Y(-40), vw, Math.max(1, 1.2 * s));
    ctx.fillStyle = '#8f877a';                       // floor
    ctx.fillRect(0, Y(-74), vw, layout.vh);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, 0.8 * s);
    ctx.beginPath();
    const mid = layout.W / 2;
    for (let x = -200; x < layout.W + 200; x += 190) {
        ctx.moveTo(X(x), Y(0));
        ctx.lineTo(X(mid + (x - mid) * 1.18), Y(-40));
        ctx.lineTo(X(mid + (x - mid) * 1.18), Y(-74));
    }
    ctx.stroke();
    // A chalk bucket parked on the pads.
    const bx = layout.routeX + 120;
    ctx.fillStyle = '#d9d4cb';
    ctx.beginPath();
    ctx.roundRect(X(bx - 13), Y(-2), 26 * s, 30 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#f7f4ee';
    ctx.beginPath();
    ctx.ellipse(X(bx), Y(-2), 13 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade('#d9d4cb', -0.2);
    ctx.fillRect(X(bx - 13), Y(-22), 26 * s, 1.5 * s);
}

export function drawTop(ctx, view, layout) {
    const { Y, s, camY, V } = view;
    const lip = layout.lipY;
    if (camY + V < lip - 10) return;
    const vw = layout.vw;
    const g = ctx.createLinearGradient(0, Y(lip + 600), 0, Y(lip + 30));
    g.addColorStop(0, '#15171c');
    g.addColorStop(1, '#2d313a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, Y(lip + 30));
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';     // roof trusses
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath();
    for (let x = -300; x < layout.W + 300; x += 150) {
        ctx.moveTo(view.X(x), Y(lip + 330));
        ctx.lineTo(view.X(x + 150), Y(lip + 430));
        ctx.lineTo(view.X(x + 300), Y(lip + 330));
    }
    ctx.moveTo(0, Y(lip + 330)); ctx.lineTo(vw, Y(lip + 330));
    ctx.moveTo(0, Y(lip + 430)); ctx.lineTo(vw, Y(lip + 430));
    ctx.stroke();
    for (let x = 90; x < layout.W; x += 240) {        // hanging lamps
        const lg = ctx.createRadialGradient(view.X(x), Y(lip + 290), 0, view.X(x), Y(lip + 290), 140 * s);
        lg.addColorStop(0, 'rgba(255,236,200,0.5)');
        lg.addColorStop(1, 'rgba(255,236,200,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(view.X(x - 140), Y(lip + 430), 280 * s, 280 * s);
        ctx.fillStyle = '#fff6e2';
        ctx.fillRect(view.X(x - 22), Y(lip + 292), 44 * s, 4 * s);
    }
    ctx.fillStyle = '#d9d3c8';                       // the top-out deck, foreshortened
    ctx.fillRect(0, Y(lip + 30), vw, 30 * s);
    ctx.fillStyle = '#26262b';                       // rubber lip
    ctx.fillRect(0, Y(lip + 2), vw, 7 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, Y(lip + 2), vw, Math.max(1, s));
}
