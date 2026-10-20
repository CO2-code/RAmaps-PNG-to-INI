/**
 * Procedural sample Red Alert 1 maps for instant testing & demo
 */

export interface SampleMap {
  id: string;
  name: string;
  theater: 'temperat' | 'snow' | 'interior';
  description: string;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
}

export const SAMPLE_MAPS: SampleMap[] = [
  {
    id: 'hostile_waters',
    name: 'Hostile Waters (Temperate Island Bay)',
    theater: 'temperat',
    description: '4-player island map with winding river, gold ore patches, bridges, and naval choke.',
    draw: (ctx, size) => {
      // 1. Water background
      ctx.fillStyle = '#0f3d64';
      ctx.fillRect(0, 0, size, size);

      // 2. Main green island mass
      ctx.fillStyle = '#226027';
      ctx.beginPath();
      ctx.arc(size * 0.35, size * 0.35, size * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(size * 0.65, size * 0.65, size * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Land bridge
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = '#2d7a34';
      ctx.beginPath();
      ctx.moveTo(size * 0.35, size * 0.35);
      ctx.lineTo(size * 0.65, size * 0.65);
      ctx.stroke();

      // Sand beaches
      ctx.strokeStyle = '#a69255';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Ore fields (Golden yellow crystals)
      ctx.fillStyle = '#e6b800';
      for (let i = 0; i < 20; i++) {
        const ox = size * 0.3 + (Math.sin(i * 1.5) * size * 0.12);
        const oy = size * 0.3 + (Math.cos(i * 1.5) * size * 0.12);
        ctx.fillRect(ox, oy, 3, 3);
      }
      for (let i = 0; i < 20; i++) {
        const ox = size * 0.7 + (Math.sin(i * 1.5) * size * 0.12);
        const oy = size * 0.7 + (Math.cos(i * 1.5) * size * 0.12);
        ctx.fillRect(ox, oy, 3, 3);
      }

      // Base starting locations (Red & Blue radar blips)
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(size * 0.2, size * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff2222';
      ctx.beginPath();
      ctx.arc(size * 0.8, size * 0.8, 5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'snow_valley',
    name: 'Siberian Ridge (Snow Pass)',
    theater: 'snow',
    description: 'Frozen pass with icy cliffs, mountain valleys, and frozen river crossings.',
    draw: (ctx, size) => {
      // Snow ground
      ctx.fillStyle = '#dbe5eb';
      ctx.fillRect(0, 0, size, size);

      // Dark ice river
      ctx.fillStyle = '#517a94';
      ctx.beginPath();
      ctx.moveTo(0, size * 0.3);
      ctx.bezierCurveTo(size * 0.4, size * 0.3, size * 0.6, size * 0.7, size, size * 0.7);
      ctx.lineTo(size, size * 0.85);
      ctx.bezierCurveTo(size * 0.6, size * 0.85, size * 0.4, size * 0.45, 0, size * 0.45);
      ctx.closePath();
      ctx.fill();

      // Rock ridge cliffs
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(size * 0.45, 0, size * 0.1, size * 0.4);
      ctx.fillRect(size * 0.45, size * 0.6, size * 0.1, size * 0.4);

      // Pine trees (Dark green spots)
      ctx.fillStyle = '#1e382b';
      for (let i = 0; i < 40; i++) {
        const tx = (i * 37) % size;
        const ty = (i * 29) % size;
        if (Math.abs(ty - size * 0.5) > 15) {
          ctx.fillRect(tx, ty, 3, 3);
        }
      }

      // Tiberium / Ore patch
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, 8, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'soviet_bunker',
    name: 'Command Bunker (Interior)',
    theater: 'interior',
    description: 'Underground missile silo with steel plates, hazard corridors, and control rooms.',
    draw: (ctx, size) => {
      // Dark steel floor
      ctx.fillStyle = '#22262d';
      ctx.fillRect(0, 0, size, size);

      // Concrete walls grid
      ctx.fillStyle = '#475569';
      ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.05);
      ctx.fillRect(size * 0.2, size * 0.75, size * 0.6, size * 0.05);
      ctx.fillRect(size * 0.2, size * 0.2, size * 0.05, size * 0.6);
      ctx.fillRect(size * 0.75, size * 0.2, size * 0.05, size * 0.6);

      // Central Silo Core
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.5, size * 0.06, 0, Math.PI * 2);
      ctx.fill();

      // Yellow hazard stripes
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(size * 0.35, size * 0.35, size * 0.3, size * 0.3);
      ctx.setLineDash([]);
    },
  },
];
