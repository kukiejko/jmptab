const colors = ['#173b70', '#2464a4', '#328ec2', '#50b9c6', '#99d5a9', '#e3df77', '#f4a756', '#d96642', '#a43139'];
const xml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const round = value => Number(value.toFixed(2));
const color = (value, [min, max]) => colors[Math.min(colors.length - 1, Math.max(0, Math.floor((value - min) / (max - min || 1) * colors.length)))];
const labels = (model, data) => ({ x: data.headers[model.xColumn], y: data.headers[model.yColumn], z: data.headers[model.responseColumn] });
const fmt = value => Number(value.toPrecision(4)).toString();

function legend(model) {
  const [min, max] = model.zDomain;
  return `<text x="632" y="80" class="legend-title">${xml('Response')}</text>${colors.map((shade, index) =>
    `<rect x="634" y="${96 + (colors.length - index - 1) * 34}" width="22" height="34" fill="${shade}"/><text x="664" y="${118 + (colors.length - index - 1) * 34}">${xml(fmt(min + (max - min) * (index + .5) / colors.length))}</text>`).join('')}`;
}

function base(content, title) {
  return `<svg class="chart response-surface-chart" viewBox="0 0 760 520" role="img" aria-label="${xml(title)}" xmlns="http://www.w3.org/2000/svg"><style>text{font:13px Arial,sans-serif;fill:#1d334e}.title{font-size:20px;font-weight:bold}.axis{font-weight:bold}.legend-title{font-weight:bold}.grid{stroke:#dce5ee;stroke-width:1}.outline{stroke:#243b57;stroke-width:1.2}</style>${content}</svg>`;
}

export function drawContourPlot(model, data) {
  const { x, y, z } = labels(model, data);
  const left = 78, top = 80, width = 510, height = 358;
  const size = model.grid.length - 1;
  const cells = [];
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const average = (model.grid[row][column] + model.grid[row + 1][column] + model.grid[row][column + 1] + model.grid[row + 1][column + 1]) / 4;
    cells.push(`<rect x="${round(left + column * width / size)}" y="${round(top + (size - row - 1) * height / size)}" width="${round(width / size + .5)}" height="${round(height / size + .5)}" fill="${color(average, model.zDomain)}"/>`);
  }
  const contours = [];
  for (let levelIndex = 1; levelIndex < colors.length; levelIndex++) {
    const level = model.zDomain[0] + (model.zDomain[1] - model.zDomain[0]) * levelIndex / colors.length;
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const corners = [[column,row,model.grid[row][column]],[column+1,row,model.grid[row][column+1]],
        [column+1,row+1,model.grid[row+1][column+1]],[column,row+1,model.grid[row+1][column]]];
      const crossings = [];
      for (let edge = 0; edge < 4; edge++) {
        const first = corners[edge], second = corners[(edge + 1) % 4];
        if ((first[2] < level) === (second[2] < level) || first[2] === second[2]) continue;
        const fraction = (level - first[2]) / (second[2] - first[2]);
        crossings.push([left + (first[0] + fraction * (second[0] - first[0])) * width / size,
          top + (size - first[1] - fraction * (second[1] - first[1])) * height / size]);
      }
      for (let index = 0; index + 1 < crossings.length; index += 2) contours.push(`<path d="M${round(crossings[index][0])} ${round(crossings[index][1])}L${round(crossings[index+1][0])} ${round(crossings[index+1][1])}" fill="none" stroke="#183958" stroke-width="1.35" opacity=".85"/>`);
    }
  }
  const ticks = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    return `<text x="${round(left + fraction * width)}" y="459" text-anchor="middle">${xml(fmt(model.xDomain[0] + fraction * (model.xDomain[1] - model.xDomain[0])))}</text><text x="65" y="${round(top + (1 - fraction) * height + 4)}" text-anchor="end">${xml(fmt(model.yDomain[0] + fraction * (model.yDomain[1] - model.yDomain[0])))}</text>`;
  }).join('');
  return base(`<text class="title" x="380" y="34" text-anchor="middle">Contour Plot of ${xml(z)}</text>${cells.join('')}${contours.join('')}<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="none" class="outline"/>${ticks}<text class="axis" x="${left + width/2}" y="495" text-anchor="middle">${xml(x)}</text><text class="axis" x="20" y="260" transform="rotate(-90 20 260)" text-anchor="middle">${xml(y)}</text>${legend(model)}`, `Contour Plot of ${z}`);
}

export function drawSurfacePlot(model, data, rotation = { yaw: -35, pitch: 30, roll: 0 }) {
  const { x, y, z } = labels(model, data);
  const yaw = rotation.yaw * Math.PI / 180, pitch = rotation.pitch * Math.PI / 180, roll = rotation.roll * Math.PI / 180;
  const [min, max] = model.zDomain;
  const project = (column, row, value) => {
    const xx = column / (model.grid.length - 1) * 2 - 1;
    const yy = row / (model.grid.length - 1) * 2 - 1;
    const zz = (value - min) / (max - min || 1) * 1.5 - .75;
    const a = xx * Math.cos(yaw) - yy * Math.sin(yaw), b = xx * Math.sin(yaw) + yy * Math.cos(yaw);
    const c = b * Math.cos(pitch) - zz * Math.sin(pitch), d = b * Math.sin(pitch) + zz * Math.cos(pitch);
    return [round(328 + (a * Math.cos(roll) - c * Math.sin(roll)) * 150), round(266 - (a * Math.sin(roll) + c * Math.cos(roll)) * 150), d];
  };
  const cells = [];
  const size = model.grid.length - 1;
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const values = [model.grid[row][column], model.grid[row][column+1], model.grid[row+1][column+1], model.grid[row+1][column]];
    const points = [[column,row],[column+1,row],[column+1,row+1],[column,row+1]].map(([c,r], index) => project(c,r,values[index]));
    cells.push({ depth: points.reduce((sum, point) => sum + point[2], 0), svg: `<polygon points="${points.map(point => `${point[0]},${point[1]}`).join(' ')}" fill="${color(values.reduce((sum, value) => sum + value, 0)/4, model.zDomain)}" stroke="#214563" stroke-opacity=".45" stroke-width=".5"/>` });
  }
  cells.sort((a,b) => a.depth - b.depth);
  const origin = project(0,0,min), endX = project(size,0,min), endY = project(0,size,min), endZ = project(0,0,max);
  const axes = [[origin,endX,x],[origin,endY,y],[origin,endZ,z]].map(([start,end,label]) => `<path d="M${start[0]} ${start[1]}L${end[0]} ${end[1]}" stroke="#172f49" stroke-width="2"/><text x="${end[0]}" y="${end[1]-8}" class="axis">${xml(label)}</text>`).join('');
  return base(`<text class="title" x="380" y="34" text-anchor="middle">Surface Plot of ${xml(z)}</text>${cells.map(cell => cell.svg).join('')}${axes}${legend(model)}`, `Surface Plot of ${z}`);
}
