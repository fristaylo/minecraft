import type { Theme } from '@/api';

type Palette = {
  sky: [string, string];
  sun?: string;
  cloud?: string;
  far: string;
  far2: string;
  top: [string, string];
  sub: [string, string];
  deep: [string, string];
  ore: string;
  tree: 'oak' | 'birch' | 'spruce' | 'cactus' | 'fungus' | 'chorus';
  leaf: [string, string];
  trunk: string;
  liquid?: string;
  stars?: boolean;
  fx?: 'snow' | 'ash';
};

type Cloud = { x: number; y: number; w: number; v: number };
type Particle = { x: number; y: number; v: number; d: number };
type Texture = 'dirt' | 'grass' | 'stone' | 'planks' | 'iron' | 'sand' | 'nether' | 'end' | 'snow';

export type Scene = {
  canvas: HTMLCanvasElement;
  palette: Palette;
  clouds: Cloud[];
  particles: Particle[];
  width: number;
  height: number;
};

const PAL: Record<Texture, string[]> = {
  dirt: ['#6b4a2f', '#5c3f27', '#7a5636', '#4d3420'],
  grass: ['#5ea336', '#6cb33f', '#4f8a2b', '#78bf48'],
  stone: ['#6f6f6f', '#7b7b7b', '#626262', '#878787'],
  planks: ['#a2824e', '#977747', '#b08e57', '#8a6a3e'],
  iron: ['#c9c9c9', '#d8d8d8', '#b9b9b9', '#e3e3e3'],
  sand: ['#e3d39d', '#d9c88f', '#ecdeac', '#cdbb82'],
  nether: ['#6e2420', '#7a2a24', '#5e1d1a', '#843029'],
  end: ['#e3e1b0', '#d6d49f', '#ebe9bf', '#cbc993'],
  snow: ['#f4f8fb', '#e6edf3', '#ffffff', '#dbe4ec'],
};

const THEMES: Record<Theme, Palette> = {
  day: { sky: ['#4f86d1', '#b8d6f2'], sun: '#fff6cf', cloud: '#ffffff', far: '#7d9cb8', far2: '#a2bccf', top: ['#6cb33f', '#5ea336'], sub: ['#7a5636', '#6b4a2f'], deep: ['#6b6b6b', '#777777'], ore: '#2d2d2d', tree: 'oak', leaf: ['#4a8f2c', '#3c7a24'], trunk: '#6a4a2a', liquid: '#3f6fd6' },
  dusk: { sky: ['#251f40', '#d47a4e'], sun: '#ffb874', cloud: '#9a6474', far: '#3a3050', far2: '#5a4060', top: ['#4f7f2f', '#446f28'], sub: ['#5a3e28', '#4c3421'], deep: ['#4a4a50', '#55555b'], ore: '#e0503a', tree: 'oak', leaf: ['#30602a', '#284f22'], trunk: '#4a3420', liquid: '#4a4f8f' },
  night: { sky: ['#060914', '#1d2a55'], stars: true, sun: '#e8ecf3', cloud: '#273257', far: '#121933', far2: '#1a2344', top: ['#2f5a2a', '#284d24'], sub: ['#3f2c1e', '#36261a'], deep: ['#3a3a42', '#44444c'], ore: '#d98a3d', tree: 'oak', leaf: ['#1f3d1c', '#1a3418'], trunk: '#3a2a1a', liquid: '#1e2c5c' },
  dawn: { sky: ['#5f7fbd', '#f4cc98'], sun: '#fff2c8', cloud: '#f6e9de', far: '#8494b0', far2: '#aab3c8', top: ['#76b546', '#68a83f'], sub: ['#7a5636', '#6b4a2f'], deep: ['#6f6f6f', '#7b7b7b'], ore: '#3a3a3a', tree: 'birch', leaf: ['#6ea845', '#5e9a3a'], trunk: '#e8e4d8', liquid: '#4a78d0' },
  snow: { sky: ['#8fadd3', '#e8eff6'], sun: '#ffffff', cloud: '#f7fafc', far: '#b3c3d6', far2: '#ccd8e5', top: ['#f4f8fb', '#e3ebf2'], sub: ['#6b4a2f', '#5c3f27'], deep: ['#707478', '#7c8084'], ore: '#3a3a3a', tree: 'spruce', leaf: ['#2e5a3a', '#264d31'], trunk: '#4a3420', liquid: '#a9c6e6', fx: 'snow' },
  desert: { sky: ['#5d9bd6', '#f2deaa'], sun: '#fff3b8', cloud: '#fff8ea', far: '#d4b385', far2: '#e2c79e', top: ['#e8d39a', '#dcc68a'], sub: ['#d9c28a', '#cdb67e'], deep: ['#c9a96a', '#b9995c'], ore: '#a87a3a', tree: 'cactus', leaf: ['#5a8f3a', '#4a7f2c'], trunk: '#4a7f2c', liquid: '#3f8fd6' },
  nether: { sky: ['#1f0707', '#5a1a12'], far: '#3a1210', far2: '#4c1814', top: ['#7a2a24', '#6e2420'], sub: ['#6a2420', '#5e201c'], deep: ['#5a1e1a', '#4e1a16'], ore: '#efe7dc', tree: 'fungus', leaf: ['#b8362c', '#962c24'], trunk: '#5a3a4a', liquid: '#f07a1c', fx: 'ash' },
  end: { sky: ['#0b0814', '#271d38'], stars: true, far: '#1a1430', far2: '#231a3c', top: ['#e3e1b0', '#d8d6a2'], sub: ['#d4d29c', '#c9c791'], deep: ['#c4c28c', '#b9b782'], ore: '#9a6bd1', tree: 'chorus', leaf: ['#9a6bb8', '#7c5398'], trunk: '#6e4590' },
};

const BLOCKS: Record<Theme, 'grass' | 'machine' | 'ore' | 'planks' | 'snow' | 'sand' | 'nether' | 'end'> = {
  day: 'grass',
  dusk: 'machine',
  night: 'ore',
  dawn: 'planks',
  snow: 'snow',
  desert: 'sand',
  nether: 'nether',
  end: 'end',
};

const blockCache = new Map<Theme, string>();

export function blockIcon(theme: Theme): string {
  const cached = blockCache.get(theme);
  if (cached) return cached;
  const kind = BLOCKS[theme];
  const canvas = createCanvas(16, 16);
  const g = context(canvas);
  const random = rng(`b${kind}`);
  const capped = (top: Texture) => {
    g.drawImage(texture('dirt'), 0, 0);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(random() * 3);
      for (let y = 0; y < depth; y++) {
        g.fillStyle = pick(PAL[top], random);
        g.fillRect(x, y, 1, 1);
      }
    }
  };
  if (kind === 'grass') capped('grass');
  else if (kind === 'snow') capped('snow');
  else if (kind === 'machine') {
    g.drawImage(texture('iron'), 0, 0);
    g.fillStyle = '#5d5d5d';
    [[0, 0, 16, 1], [0, 15, 16, 1], [0, 0, 1, 16], [15, 0, 1, 16]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
    g.fillStyle = '#2a2a2a';
    g.fillRect(4, 4, 8, 8);
    g.fillStyle = '#c8412f';
    g.fillRect(6, 6, 4, 4);
    g.fillStyle = '#ff7a5c';
    g.fillRect(6, 6, 2, 2);
  } else if (kind === 'ore') {
    g.drawImage(texture('stone'), 0, 0);
    [[3, 3], [10, 5], [5, 10], [11, 11], [7, 7]].forEach(([x, y]) => {
      g.fillStyle = '#d98a3d';
      g.fillRect(x, y, 2, 2);
      g.fillStyle = '#f0b070';
      g.fillRect(x, y, 1, 1);
    });
  } else {
    g.drawImage(texture(kind), 0, 0);
    if (kind === 'nether') {
      g.fillStyle = '#efe7dc';
      [[3, 4], [11, 3], [6, 11], [12, 12]].forEach(([x, y]) => {
        g.fillRect(x, y, 2, 1);
        g.fillRect(x + 1, y + 1, 1, 1);
      });
    }
  }
  const url = canvas.toDataURL();
  blockCache.set(theme, url);
  return url;
}

export function createScene(theme: Theme, seed: string, width: number, height: number): Scene {
  const canvas = createCanvas(width, height);
  const g = context(canvas);
  const random = rng(seed);
  const palette = THEMES[theme];
  const sky = g.createLinearGradient(0, 0, 0, height * 0.8);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);
  if (palette.stars) {
    for (let i = 0; i < width * 0.6; i++) {
      g.fillStyle = random() > 0.7 ? '#ffffff' : 'rgba(190,200,255,.55)';
      g.fillRect((random() * width) | 0, (random() * height * 0.6) | 0, 1, 1);
    }
  }
  if (palette.sun) {
    const size = Math.max(7, (width / 20) | 0);
    g.fillStyle = palette.sun;
    g.fillRect((width * (0.6 + random() * 0.25)) | 0, (height * 0.1) | 0, size, size);
  }
  const ridge = (base: number, amplitude: number, color: string, frequency: number) => {
    const phase = random() * 9;
    for (let x = 0; x < width; x++) {
      const y = Math.round(base + Math.sin(x * frequency + phase) * amplitude + Math.sin(x * frequency * 2.7 + phase * 2) * amplitude * 0.35);
      g.fillStyle = color;
      g.fillRect(x, y, 1, height - y);
    }
  };
  ridge(height * 0.42, height * 0.08, palette.far2, 0.028);
  ridge(height * 0.53, height * 0.06, palette.far, 0.045);

  const sea = Math.round(height * 0.76);
  let level = Math.round(height * 0.66);
  const columns: number[] = [];
  for (let x = 0; x < width; x += 2) {
    if (random() < 0.4) level += random() < 0.5 ? -1 : 1;
    if (random() < 0.05) level += random() < 0.5 ? -2 : 2;
    level = Math.max(Math.round(height * 0.56), Math.min(Math.round(height * 0.86), level));
    columns.push(level);
  }
  const flooded = (top: number) => palette.liquid !== undefined && top > sea;
  columns.forEach((top, i) => {
    const x = i * 2;
    if (palette.liquid && flooded(top)) {
      g.fillStyle = palette.liquid;
      g.fillRect(x, sea, 2, top - sea + 1);
    }
    for (let y = top; y < height; y++) {
      const depth = y - top;
      if (depth === 0) g.fillStyle = flooded(top) ? palette.sub[0] : palette.top[random() < 0.3 ? 1 : 0];
      else if (depth < 4) g.fillStyle = palette.sub[random() < 0.3 ? 1 : 0];
      else g.fillStyle = random() < 0.025 ? palette.ore : palette.deep[random() < 0.35 ? 1 : 0];
      g.fillRect(x, y, 2, 1);
    }
  });
  let last = -20;
  columns.forEach((top, i) => {
    const x = i * 2;
    if (flooded(top) || random() > 0.1 || x - last < 11 || x < 5 || x > width - 7) return;
    last = x;
    drawTree(g, palette, x, top, random);
  });

  return {
    canvas,
    palette,
    width,
    height,
    clouds: palette.cloud
      ? Array.from({ length: Math.ceil(width / 38) }, () => ({
          x: random() * width,
          y: 2 + Math.floor(random() * height * 0.3),
          w: 12 + Math.floor(random() * 22),
          v: 0.5 + random() * 0.7,
        }))
      : [],
    particles: palette.fx
      ? Array.from({ length: Math.ceil(width * 0.35) }, () => ({ x: random() * width, y: random() * height, v: 0.3 + random() * 0.6, d: random() * 6 }))
      : [],
  };
}

export function paintScene(target: HTMLCanvasElement, scene: Scene, offset: number) {
  const g = context(target);
  const { palette, width, height } = scene;
  g.drawImage(scene.canvas, 0, 0);
  if (palette.cloud) {
    g.fillStyle = palette.cloud;
    scene.clouds.forEach((cloud) => {
      const span = width + cloud.w * 2;
      const x = ((((cloud.x + offset * cloud.v * 0.25) % span) + span) % span) - cloud.w;
      g.fillRect(x | 0, cloud.y, cloud.w, 3);
      g.fillRect((x + 3) | 0, cloud.y - 2, Math.max(4, cloud.w - 9), 2);
      g.fillRect((x + 6) | 0, cloud.y + 3, Math.max(2, cloud.w - 14), 1);
    });
  }
  scene.particles.forEach((particle) => {
    const y = (((particle.y + offset * particle.v * (palette.fx === 'ash' ? -0.3 : 0.5)) % height) + height) % height;
    const x = (((particle.x + Math.sin(offset * 0.03 + particle.d) * 2) % width) + width) % width;
    g.fillStyle = palette.fx === 'ash' ? (particle.d > 3 ? '#f0a040' : '#c84a2a') : '#ffffff';
    g.fillRect(x | 0, y | 0, 1, 1);
  });
}

function drawTree(g: CanvasRenderingContext2D, palette: Palette, x: number, top: number, random: () => number) {
  const [leaf, shade] = palette.leaf;
  const rect = (color: string, ...boxes: number[][]) => {
    g.fillStyle = color;
    boxes.forEach(([bx, by, w, h]) => g.fillRect(bx, by, w, h));
  };
  const height = 4 + Math.floor(random() * 3);
  switch (palette.tree) {
    case 'oak':
    case 'birch':
      rect(palette.trunk, [x, top - height, 1, height]);
      if (palette.tree === 'birch') rect('#2a2a2a', [x, top - height + 1, 1, 1]);
      rect(leaf, [x - 3, top - height - 3, 7, 3], [x - 2, top - height - 5, 5, 2]);
      rect(shade, [x - 3, top - height - 1, 7, 1], [x + 1, top - height - 4, 2, 1]);
      break;
    case 'spruce':
      rect(palette.trunk, [x, top - 3, 1, 3]);
      [[7, 3], [5, 6], [3, 9], [1, 11]].forEach(([w, o], k) => rect(k % 2 ? shade : leaf, [x - (w >> 1), top - o - 2, w, 2]));
      rect('#f4f8fb', [x - 3, top - 5, 2, 1], [x - 1, top - 11, 2, 1]);
      break;
    case 'cactus':
      rect(leaf, [x, top - height, 1, height]);
      rect(shade, [x - 2, top - height + 2, 1, 2], [x - 1, top - height + 3, 1, 1], [x + 2, top - height + 1, 1, 2], [x + 1, top - height + 2, 1, 1]);
      break;
    case 'fungus':
      rect(palette.trunk, [x, top - height - 1, 1, height + 1]);
      rect(leaf, [x - 3, top - height - 3, 7, 2]);
      rect(shade, [x - 2, top - height - 4, 5, 1]);
      rect('#f0b23c', [x - 3, top - height - 1, 1, 1], [x + 3, top - height - 1, 1, 1]);
      break;
    case 'chorus':
      rect(shade, [x, top - 7, 1, 7], [x - 2, top - 5, 2, 1], [x - 2, top - 8, 1, 3], [x + 1, top - 9, 2, 1], [x + 2, top - 11, 1, 2]);
      rect(leaf, [x - 2, top - 9, 1, 1], [x + 2, top - 12, 1, 1], [x, top - 8, 1, 1]);
      break;
  }
}

function texture(kind: Texture): HTMLCanvasElement {
  const canvas = createCanvas(16, 16);
  const g = context(canvas);
  const random = rng(kind);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      g.fillStyle = pick(PAL[kind], random);
      g.fillRect(x, y, 1, 1);
    }
  }
  if (kind === 'planks') {
    g.fillStyle = '#6e5333';
    [3, 7, 11, 15].forEach((y) => g.fillRect(0, y, 16, 1));
    [[5, 0], [12, 4], [2, 8], [9, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 3));
  }
  return canvas;
}

function rng(seed: string): () => number {
  let state = [...seed].reduce((acc, char) => (Math.imul(acc, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(colors: string[], random: () => number): string {
  return colors[Math.floor(random() * colors.length)];
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return canvas.getContext('2d')!;
}
