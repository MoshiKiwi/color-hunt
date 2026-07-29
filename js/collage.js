function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger ${url}`));
    img.src = url;
  });
}

// Center-crop `img` to fill a cellSize x cellSize square at (x, y).
function drawCover(ctx, img, x, y, cellSize) {
  const scale = Math.max(cellSize / img.width, cellSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const sx = x + (cellSize - w) / 2;
  const sy = y + (cellSize - h) / 2;
  ctx.drawImage(img, sx, sy, w, h);
}

export async function buildCollage(photoUrls, { cellSize = 320, gap = 6 } = {}) {
  if (!photoUrls.length) throw new Error('Aucune photo à assembler');

  const images = await Promise.all(photoUrls.map(loadImage));
  const columns = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / columns);

  const canvas = document.createElement('canvas');
  canvas.width = columns * cellSize + (columns + 1) * gap;
  canvas.height = rows * cellSize + (rows + 1) * gap;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  images.forEach((img, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = gap + col * (cellSize + gap);
    const y = gap + row * (cellSize + gap);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellSize, cellSize);
    ctx.clip();
    drawCover(ctx, img, x, y, cellSize);
    ctx.restore();
  });

  return canvas;
}

export function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
