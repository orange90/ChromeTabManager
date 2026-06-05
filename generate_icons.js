const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.45;

  ctx.clearRect(0, 0, size, size);

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#ff9500');
  gradient.addColorStop(1, '#ff6b00');

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = size * 0.04;
  ctx.stroke();

  const iconSize = size * 0.3;
  const iconX = centerX - iconSize / 2;
  const iconY = centerY - iconSize / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(iconX, iconY, iconSize, iconSize);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const gap = size * 0.04;
  ctx.fillRect(iconX - gap, iconY - gap, iconSize + gap * 2, size * 0.06);
  ctx.fillRect(iconX - gap, iconY + iconSize - size * 0.02, iconSize + gap * 2, size * 0.06);
  ctx.fillRect(iconX - gap, iconY - gap, size * 0.06, iconSize + gap * 2);
  ctx.fillRect(iconX + iconSize - size * 0.02, iconY - gap, size * 0.06, iconSize + gap * 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png`);
}

for (const size of sizes) {
  generateIcon(size);
}

console.log('All icons generated successfully!');
