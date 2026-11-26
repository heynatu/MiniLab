// Original MiniLab characters. Each one is a printable line drawing plus a rig
// (bones and weights) that turns the child's coloring into an animated 3D toy.
//
// Coordinates: drawing area 1000 x 1250 units. Parts are listed back to front.
// Detail kinds: line (stroke), region (closed, colorable), ink (solid black), shine (white highlight).
import { ellipse, circle, blob, curve, line, tube, spike, star, heart, cloud, flower, waveBand, hills, mirror, sampleSpline } from './geo.js';

const S = Math.sin;
const region = (d, demo) => ({ d, kind: 'region', demo });
const ln = (d) => ({ d, kind: 'line' });
const ink = (d) => ({ d, kind: 'ink' });
const shine = (d) => ({ d, kind: 'shine' });

function eye(cx, cy, rx, ry) {
  return [ink(ellipse(cx, cy, rx, ry)), shine(circle(cx + rx * 0.3, cy - ry * 0.35, rx * 0.38))];
}

function flowerItems(cx, cy, r, petal, center) {
  const fl = flower(cx, cy, r);
  return [region(fl.petals, petal), region(fl.center, center)];
}

function stem(x, y0, y1) {
  return ln(curve([[x, y0], [x - 12, (y0 + y1) / 2], [x, y1]]));
}

// ---------------------------------------------------------------- whale
const whale = {
  id: 1,
  slug: 'ca-voi',
  name: 'Cá voi Bông',
  category: 'bien',
  level: 1,
  theme: 'sea',
  blurb: 'Bạn cá voi thích phun nước và vẫy đuôi chào cả lớp.',
  bg: '#CDEFFF',
  hover: 0.45,
  scenery: [
    region(waveBand(1060, 26, 4), '#7FD0F5'),
    region(tube([[880, 1250], [905, 1160], [870, 1090], [900, 1010]], 46, 26), '#3DD6A3'),
    region(tube([[110, 1250], [90, 1170], [125, 1100], [105, 1040]], 42, 24), '#3DD6A3'),
    region(star(300, 1150, 52, 0.5, 5, 10), '#FFB020'),
    region(circle(905, 300, 30), '#FFFFFF'),
    region(circle(935, 225, 18), '#FFFFFF'),
    region(circle(890, 170, 12), '#FFFFFF'),
    region(circle(110, 800, 26), '#FFFFFF'),
    region(circle(80, 725, 14), '#FFFFFF'),
    region(cloud(160, 140, 190), '#FFFFFF'),
  ],
  parts: [
    {
      id: 'tail', bone: 'tail', puff: 0.7, color: '#5BA8F5',
      d: tube([[340, 590], [260, 560], [215, 480], [210, 400]], 120, 64) + ellipse(150, 360, 78, 36, -25) + ellipse(272, 360, 78, 36, 25),
      chain: { bones: ['tail', 'tail2'], tip: [210, 330] },
      details: [ln(curve([[150, 360], [200, 372], [240, 366]]))],
    },
    {
      id: 'spout', bone: 'spout', puff: 0.55, color: '#9EE3FF',
      d: tube([[700, 400], [700, 330], [700, 285]], 40, 54) + circle(648, 262, 38) + circle(752, 262, 38) + circle(700, 228, 46),
      details: [],
    },
    {
      id: 'body', bone: 'body', puff: 1, color: '#5BA8F5',
      d: blob([[880, 600], [858, 478], [760, 398], [600, 368], [440, 393], [320, 470], [272, 580], [322, 690], [460, 760], [650, 772], [800, 722]]),
      details: [
        region(blob([[350, 702], [480, 712], [640, 716], [800, 690], [770, 725], [650, 760], [470, 752]]), '#FFF1D6'),
        ln(line([[500, 714], [495, 750]])),
        ln(line([[580, 716], [578, 758]])),
        ln(line([[660, 714], [662, 752]])),
        region(circle(480, 470, 26), '#8CC6FF'),
        region(circle(560, 438, 17), '#8CC6FF'),
        region(circle(420, 525, 16), '#8CC6FF'),
        region(ellipse(735, 618, 32, 19), '#FF9EC0'),
        ...eye(780, 556, 22, 28),
        ln(curve([[772, 646], [815, 666], [856, 642]])),
      ],
    },
    {
      id: 'fin', bone: 'fin', puff: 0.5, color: '#4C8FE0',
      d: ellipse(560, 712, 88, 40, 28),
      details: [],
    },
  ],
  bones: [
    { name: 'root', x: 575, y: 772 },
    { name: 'body', parent: 'root', x: 575, y: 580 },
    { name: 'tail', parent: 'body', x: 330, y: 585 },
    { name: 'tail2', parent: 'tail', x: 214, y: 455 },
    { name: 'fin', parent: 'body', x: 520, y: 690 },
    { name: 'spout', parent: 'body', x: 700, y: 400 },
  ],
  idle(t, B) {
    B.root.position.y += S(t * 1.6) * 0.07;
    B.root.rotation.z += S(t * 1.6 + 0.6) * 0.05;
    B.tail.rotation.z += S(t * 2.4) * 0.22;
    B.tail2.rotation.z += S(t * 2.4 - 0.9) * 0.35;
    B.fin.rotation.z += S(t * 3) * 0.35;
    B.spout.scale.y = 1 + 0.18 * S(t * 4.5);
    B.spout.scale.x = 1 - 0.08 * S(t * 4.5);
  },
  special: {
    label: 'Phun nước', icon: 'sparkle', dur: 1.6, sound: 'splash', particles: 'water', at: 'spout',
    update(p, B) {
      const k = Math.sin(p * Math.PI);
      B.spout.scale.set(1 + k * 0.35, 1 + k * 0.9, 1 + k * 0.35);
      B.body.rotation.z += -k * 0.08;
    },
  },
};

// ---------------------------------------------------------------- dino
const dinoSpikes = [
  spike(330, 690, 80, 70, -55), spike(395, 640, 90, 82, -30), spike(480, 612, 96, 88, -8),
  spike(570, 612, 90, 80, 14), spike(612, 430, 70, 60, -70), spike(650, 360, 74, 66, -45),
].join('');

const dino = {
  id: 2,
  slug: 'khung-long',
  name: 'Khủng long Xíu',
  category: 'dong-vat',
  level: 2,
  theme: 'meadow',
  blurb: 'Xíu nhỏ xíu nhưng gầm rất to. Chạm vào để nghe bạn ấy gầm nhé.',
  bg: '#E9F9D9',
  hover: 0,
  scenery: [
    region(hills(1040, 3), '#9BE08A'),
    region(circle(150, 160, 70), '#FFD84D'),
    ln(line([[150, 60], [150, 40]]) + line([[250, 160], [272, 160]]) + line([[220, 90], [236, 74]]) + line([[80, 90], [64, 74]]) + line([[220, 230], [236, 246]])),
    region(cloud(780, 150, 220), '#FFFFFF'),
    ...flowerItems(110, 1120, 60, '#FF9EC0', '#FFD84D'),
    ...flowerItems(880, 1140, 54, '#C4B5FD', '#FFD84D'),
    ln(curve([[300, 1180], [310, 1140], [325, 1180]]) + curve([[700, 1200], [712, 1160], [724, 1200]])),
  ],
  parts: [
    {
      id: 'tail', bone: 'tail1', puff: 0.85, color: '#6FCF6B',
      d: tube([[420, 830], [310, 860], [200, 850], [100, 790]], 180, 34),
      chain: { bones: ['tail1', 'tail2'], tip: [100, 790] },
      details: [region(circle(300, 850, 20), '#B6EFA6'), region(circle(210, 838, 14), '#B6EFA6')],
    },
    {
      id: 'legB', bone: 'legB', puff: 0.8, color: '#5DBF5A',
      d: tube([[445, 880], [440, 960], [440, 1000]], 112, 104) + ellipse(452, 1008, 78, 34),
      details: [ln(line([[420, 1010], [420, 1040]]) + line([[460, 1010], [460, 1040]]))],
    },
    {
      id: 'legF', bone: 'legF', puff: 0.8, color: '#5DBF5A',
      d: tube([[625, 880], [630, 960], [630, 1000]], 112, 104) + ellipse(645, 1008, 78, 34),
      details: [ln(line([[620, 1010], [620, 1040]]) + line([[662, 1010], [662, 1040]]))],
    },
    {
      id: 'spikes', bone: 'body', puff: 0.35, color: '#FFB020',
      d: dinoSpikes,
      details: [],
    },
    {
      id: 'body', bone: 'body', puff: 1, color: '#6FCF6B',
      d: blob([[300, 780], [340, 690], [430, 630], [560, 610], [660, 640], [720, 720], [722, 830], [662, 920], [540, 952], [410, 932], [318, 870]]),
      details: [
        region(ellipse(605, 822, 100, 106, -12), '#FFF1C2'),
        ln(curve([[525, 770], [600, 762], [670, 760]])),
        ln(curve([[515, 825], [600, 818], [690, 812]])),
        ln(curve([[530, 878], [600, 874], [670, 868]])),
        region(circle(420, 760, 30), '#B6EFA6'),
        region(circle(380, 835, 20), '#B6EFA6'),
        region(circle(470, 690, 22), '#B6EFA6'),
      ],
    },
    {
      id: 'arm', bone: 'arm', puff: 0.7, color: '#5DBF5A',
      d: tube([[690, 762], [745, 792], [778, 774]], 56, 44),
      details: [],
    },
    {
      id: 'head', bone: 'head', puff: 1, color: '#6FCF6B',
      d: blob([[600, 620], [585, 505], [622, 395], [722, 332], [842, 330], [932, 382], [962, 462], [942, 542], [872, 584], [762, 600], [680, 650]]),
      details: [
        ...eye(800, 438, 24, 30),
        ink(circle(912, 430, 8)),
        ink(circle(938, 446, 7)),
        ln(curve([[828, 522], [880, 545], [935, 514]])),
        region(ellipse(770, 512, 30, 18), '#FF9EC0'),
        region(circle(700, 400, 16), '#B6EFA6'),
        region(circle(670, 460, 11), '#B6EFA6'),
      ],
    },
  ],
  bones: [
    { name: 'root', x: 545, y: 1010 },
    { name: 'body', parent: 'root', x: 545, y: 800 },
    { name: 'head', parent: 'body', x: 650, y: 625 },
    { name: 'tail1', parent: 'body', x: 410, y: 830 },
    { name: 'tail2', parent: 'tail1', x: 250, y: 855 },
    { name: 'legB', parent: 'root', x: 445, y: 880 },
    { name: 'legF', parent: 'root', x: 625, y: 880 },
    { name: 'arm', parent: 'body', x: 690, y: 760 },
  ],
  idle(t, B) {
    const w = t * 4;
    B.legB.rotation.z += S(w) * 0.2;
    B.legF.rotation.z += -S(w) * 0.2;
    B.body.position.y += Math.abs(S(w)) * 0.035;
    B.body.rotation.z += S(w) * 0.02;
    B.tail1.rotation.z += S(t * 2) * 0.14;
    B.tail2.rotation.z += S(t * 2 - 0.7) * 0.28;
    B.head.rotation.z += S(t * 2 + 1) * 0.06;
    B.arm.rotation.z += S(w) * 0.3;
  },
  special: {
    label: 'Gầm thật to', icon: 'smiley', dur: 1.4, sound: 'roar', particles: 'stars', at: 'head',
    update(p, B) {
      const k = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      B.head.rotation.z += k * 0.35 + Math.sin(p * 60) * 0.03 * k;
      B.head.scale.setScalar(1 + k * 0.12);
      B.tail2.rotation.z += k * 0.4;
    },
  },
};

// ---------------------------------------------------------------- butterfly
const wingUL = [[470, 470], [420, 340], [330, 238], [210, 198], [118, 240], [108, 350], [170, 452], [290, 522], [420, 532]];
const wingLL = [[470, 572], [380, 580], [270, 640], [210, 742], [240, 832], [330, 842], [420, 772], [472, 680]];
const butterfly = {
  id: 3,
  slug: 'buom',
  name: 'Bướm Hoa',
  category: 'con-trung',
  level: 1,
  theme: 'garden',
  blurb: 'Tô hai cánh thật rực rỡ rồi xem bướm vỗ cánh bay lượn.',
  bg: '#FFF3D6',
  hover: 0.55,
  scenery: [
    region(hills(1100, 4), '#A8E6A1'),
    stem(160, 1250, 1060), ...flowerItems(160, 1040, 70, '#FF9EC0', '#FFD84D'),
    stem(500, 1250, 1110), ...flowerItems(500, 1095, 56, '#9EE3FF', '#FFD84D'),
    stem(840, 1250, 1050), ...flowerItems(840, 1030, 74, '#FFB020', '#FF7AA8'),
    region(circle(880, 140, 64), '#FFD84D'),
    region(heart(120, 120, 34), '#FF9EC0'),
    region(heart(900, 640, 26), '#FF9EC0'),
  ],
  parts: [
    { id: 'wLL', bone: 'wLL', puff: 0.16, color: '#FF9EC0', d: blob(wingLL), details: [region(circle(310, 735, 42), '#FFD84D'), region(circle(255, 795, 20), '#FFFFFF')] },
    { id: 'wLR', bone: 'wLR', puff: 0.16, color: '#FF9EC0', d: blob(mirror(wingLL)), details: [region(circle(690, 735, 42), '#FFD84D'), region(circle(745, 795, 20), '#FFFFFF')] },
    {
      id: 'wUL', bone: 'wUL', puff: 0.16, color: '#9B7BFF', d: blob(wingUL),
      details: [region(circle(255, 335, 58), '#FFD84D'), region(circle(180, 262, 24), '#FFFFFF'), region(circle(340, 455, 30), '#FF7AA8'), ln(curve([[440, 500], [330, 420], [250, 410], [175, 380]]))],
    },
    {
      id: 'wUR', bone: 'wUR', puff: 0.16, color: '#9B7BFF', d: blob(mirror(wingUL)),
      details: [region(circle(745, 335, 58), '#FFD84D'), region(circle(820, 262, 24), '#FFFFFF'), region(circle(660, 455, 30), '#FF7AA8'), ln(curve(mirror([[440, 500], [330, 420], [250, 410], [175, 380]])))],
    },
    {
      id: 'body', bone: 'body', puff: 1, color: '#5E5C7F',
      d: ellipse(500, 605, 48, 208),
      details: [ln(curve([[456, 520], [500, 532], [544, 520]])), ln(curve([[453, 600], [500, 612], [547, 600]])), ln(curve([[458, 680], [500, 692], [542, 680]]))],
    },
    {
      id: 'head', bone: 'head', puff: 1, color: '#FFB020',
      d: circle(500, 352, 64) + tube([[482, 300], [455, 232], [405, 192]], 18, 16) + circle(396, 188, 24) + tube([[518, 300], [545, 232], [595, 192]], 18, 16) + circle(604, 188, 24),
      details: [...eye(476, 345, 11, 14), ...eye(524, 345, 11, 14), ln(curve([[482, 380], [500, 392], [518, 380]])), region(ellipse(456, 375, 12, 8), '#FF9EC0'), region(ellipse(544, 375, 12, 8), '#FF9EC0')],
    },
  ],
  bones: [
    { name: 'root', x: 500, y: 815 },
    { name: 'body', parent: 'root', x: 500, y: 600 },
    { name: 'head', parent: 'body', x: 500, y: 410 },
    { name: 'wUL', parent: 'body', x: 470, y: 480 },
    { name: 'wUR', parent: 'body', x: 530, y: 480 },
    { name: 'wLL', parent: 'body', x: 474, y: 600 },
    { name: 'wLR', parent: 'body', x: 526, y: 600 },
  ],
  blend: 5,
  idle(t, B) {
    const f1 = (S(t * 9) * 0.5 + 0.5) * 1.05 + 0.08;
    const f2 = (S(t * 9 - 0.45) * 0.5 + 0.5) * 0.95 + 0.08;
    B.wUL.rotation.y += -f1;
    B.wUR.rotation.y += f1;
    B.wLL.rotation.y += -f2;
    B.wLR.rotation.y += f2;
    B.root.position.y += S(t * 2) * 0.1;
    B.root.position.x += S(t * 0.9) * 0.12;
    B.root.rotation.z += S(t * 1.3) * 0.08;
    B.head.rotation.z += S(t * 2.6) * 0.08;
  },
  special: {
    label: 'Bay vòng', icon: 'sparkle', dur: 2, sound: 'magic', particles: 'petals', at: 'body',
    update(p, B) {
      const a = p * Math.PI * 2;
      B.root.position.x += Math.sin(a) * 0.9;
      B.root.position.y += (1 - Math.cos(a)) * 0.35;
      B.root.rotation.z += Math.sin(a) * 0.3;
    },
  },
};

// ---------------------------------------------------------------- octopus
const tentacles = [
  [[345, 585], [265, 632], [195, 702], [145, 782], [100, 772]],
  [[405, 612], [355, 718], [315, 828], [285, 918], [235, 930]],
  [[465, 628], [460, 768], [455, 898], [430, 988], [388, 1000]],
  [[535, 628], [540, 768], [545, 898], [570, 988], [612, 1000]],
  [[595, 612], [645, 718], [685, 828], [715, 918], [765, 930]],
  [[655, 585], [735, 632], [805, 702], [855, 782], [900, 772]],
];
const suckers = (pts) => sampleSpline(pts, 10).slice(4, 9).filter((_, i) => i % 2 === 0).map(([x, y], i) => region(circle(x, y, 13 - i * 2), '#FFE1EC'));

const octopus = {
  id: 4,
  slug: 'bach-tuoc',
  name: 'Bạch tuộc Mực Mực',
  category: 'bien',
  level: 2,
  theme: 'sea',
  blurb: 'Sáu chiếc vòi uốn lượn và một bình mực bí mật.',
  bg: '#D6F1FF',
  hover: 0.3,
  scenery: [
    region(waveBand(1080, 18, 5), '#FFE3A3'),
    region(ellipse(200, 1160, 50, 30), '#FF9EC0'),
    ln(line([[170, 1150], [230, 1150]])),
    region(star(820, 1160, 48, 0.5, 5, -8), '#FFB020'),
    region(tube([[930, 1080], [950, 990], [920, 920], [945, 860]], 40, 24), '#3DD6A3'),
    region(blob([[100, 230], [150, 190], [210, 230], [150, 270]]) + spike(80, 230, 60, 50, -90), '#FFB020'),
    ink(circle(185, 225, 7)),
    region(circle(880, 260, 26), '#FFFFFF'),
    region(circle(850, 200, 14), '#FFFFFF'),
    region(circle(90, 560, 18), '#FFFFFF'),
  ],
  parts: [
    ...tentacles.map((pts, i) => ({
      id: `t${i + 1}`, bone: `t${i + 1}a`, puff: 0.8, color: '#FF7AA8',
      d: tube(pts, 92, 30),
      chain: { bones: [`t${i + 1}a`, `t${i + 1}b`], tip: pts[pts.length - 1] },
      details: suckers(pts),
    })),
    {
      id: 'head', bone: 'head', puff: 1, color: '#FF7AA8',
      d: blob([[500, 182], [652, 222], [742, 342], [752, 472], [702, 582], [600, 642], [400, 642], [298, 582], [248, 472], [258, 342], [348, 222]]),
      details: [
        region(ellipse(422, 432, 46, 56), '#FFFFFF'),
        region(ellipse(578, 432, 46, 56), '#FFFFFF'),
        ...eye(428, 440, 24, 30),
        ...eye(572, 440, 24, 30),
        ln(curve([[460, 528], [500, 552], [540, 528]])),
        region(ellipse(360, 505, 30, 18), '#FFB3CF'),
        region(ellipse(640, 505, 30, 18), '#FFB3CF'),
        region(circle(420, 270, 28), '#FFB3CF'),
        region(circle(560, 250, 20), '#FFB3CF'),
        region(circle(640, 330, 24), '#FFB3CF'),
        region(circle(358, 350, 17), '#FFB3CF'),
      ],
    },
  ],
  bones: [
    { name: 'root', x: 500, y: 1000 },
    { name: 'head', parent: 'root', x: 500, y: 460 },
    ...tentacles.flatMap((pts, i) => [
      { name: `t${i + 1}a`, parent: 'head', x: pts[0][0], y: pts[0][1] },
      { name: `t${i + 1}b`, parent: `t${i + 1}a`, x: pts[2][0], y: pts[2][1] },
    ]),
  ],
  idle(t, B) {
    B.head.position.y += S(t * 2) * 0.06;
    B.head.scale.x = 1 + 0.03 * S(t * 2);
    B.head.scale.y = 1 - 0.03 * S(t * 2);
    for (let i = 1; i <= 6; i++) {
      const side = i <= 3 ? -1 : 1;
      B[`t${i}a`].rotation.z += S(t * 2.2 + i * 0.9) * 0.18 * side;
      B[`t${i}b`].rotation.z += S(t * 2.2 + i * 0.9 - 1) * 0.38 * side;
    }
  },
  special: {
    label: 'Phun mực', icon: 'sparkle', dur: 1.6, sound: 'bloop', particles: 'ink', at: 'head',
    update(p, B, t) {
      const k = Math.sin(p * Math.PI);
      B.head.scale.set(1 + k * 0.12, 1 - k * 0.1, 1 + k * 0.12);
      for (let i = 1; i <= 6; i++) {
        const side = i <= 3 ? -1 : 1;
        B[`t${i}a`].rotation.z += S(t * 12 + i) * 0.25 * k * side;
      }
    },
  },
};

// ---------------------------------------------------------------- rocket
const finL = [[382, 610], [292, 712], [250, 858], [292, 902], [372, 832], [402, 782]];
const rocket = {
  id: 5,
  slug: 'ten-lua',
  name: 'Tên lửa Mơ Ước',
  category: 'vu-tru',
  level: 1,
  theme: 'space',
  blurb: 'Một bạn mèo phi hành gia đang chờ bạn tô tên lửa để cất cánh.',
  bg: '#2F2B66',
  hover: 0.55,
  scenery: [
    region(circle(170, 250, 80), '#FFB020'),
    region(ellipse(170, 255, 140, 30, -18), '#FF9EC0'),
    region(blob([[860, 140], [910, 190], [912, 260], [860, 310], [880, 250], [878, 200]]), '#FFE680'),
    region(star(90, 520, 30), '#FFE680'), region(star(900, 520, 26), '#FFE680'), region(star(780, 60, 22), '#FFE680'),
    region(star(320, 90, 20), '#FFE680'), region(star(120, 900, 24), '#FFE680'), region(star(880, 880, 30), '#FFE680'),
    region(cloud(230, 1170, 260), '#FFFFFF'), region(cloud(500, 1200, 280), '#FFFFFF'), region(cloud(780, 1170, 260), '#FFFFFF'),
  ],
  parts: [
    {
      id: 'flame', bone: 'flame', puff: 0.6, color: '#FF8A4C',
      d: blob([[420, 832], [580, 832], [602, 902], [562, 992], [522, 1062], [500, 1112], [478, 1062], [438, 992], [398, 902]]),
      details: [region(blob([[456, 842], [544, 842], [552, 902], [522, 982], [500, 1032], [478, 982], [448, 902]]), '#FFD84D')],
    },
    { id: 'finL', bone: 'finL', puff: 0.45, color: '#FF7AA8', d: blob(finL), details: [] },
    { id: 'finR', bone: 'finR', puff: 0.45, color: '#FF7AA8', d: blob(mirror(finL)), details: [] },
    {
      id: 'body', bone: 'body', puff: 1, color: '#F4F6FF',
      d: blob([[500, 170], [582, 250], [632, 380], [646, 560], [632, 762], [602, 842], [398, 842], [368, 762], [354, 560], [368, 380], [418, 250]]),
      details: [
        region(blob([[500, 172], [582, 252], [612, 318], [500, 338], [388, 318], [418, 252]]), '#FF7AA8'),
        region(circle(500, 478, 88), '#9EE3FF'),
        ln(circle(500, 478, 66)),
        region(spike(462, 450, 30, 30, -20) + spike(538, 450, 30, 30, 20), '#FFB020'),
        ...eye(478, 478, 9, 11), ...eye(522, 478, 9, 11),
        ln(curve([[488, 505], [500, 513], [512, 505]])),
        region(blob([[370, 700], [500, 726], [630, 700], [628, 752], [500, 778], [372, 752]]), '#4FB3FF'),
        region(star(500, 625, 34), '#FFD84D'),
        region(circle(410, 805, 10), '#C4B5FD'), region(circle(500, 815, 10), '#C4B5FD'), region(circle(590, 805, 10), '#C4B5FD'),
      ],
    },
  ],
  bones: [
    { name: 'root', x: 500, y: 860 },
    { name: 'body', parent: 'root', x: 500, y: 520 },
    { name: 'finL', parent: 'body', x: 380, y: 700 },
    { name: 'finR', parent: 'body', x: 620, y: 700 },
    { name: 'flame', parent: 'body', x: 500, y: 840 },
  ],
  idle(t, B) {
    B.root.position.y += S(t * 1.8) * 0.08;
    B.body.rotation.z += S(t * 1.5) * 0.06;
    B.flame.scale.y = 1 + 0.18 * S(t * 22) + 0.08 * S(t * 13);
    B.flame.scale.x = 1 - 0.06 * S(t * 22);
    B.finL.rotation.z += S(t * 3) * 0.05;
    B.finR.rotation.z += -S(t * 3) * 0.05;
  },
  special: {
    label: 'Phóng lên', icon: 'shooting-star', dur: 2.6, sound: 'launch', particles: 'smoke', at: 'flame',
    update(p, B) {
      const up = p < 0.5 ? Math.pow(p / 0.5, 2) : Math.pow((1 - p) / 0.5, 2);
      B.root.position.y += up * 6;
      B.flame.scale.y *= 1 + up * 1.2;
      B.root.rotation.y += p * Math.PI * 4;
    },
  },
};

// ---------------------------------------------------------------- cat
const earL = [[318, 402], [326, 258], [362, 192], [424, 242], [482, 332]];
const cat = {
  id: 6,
  slug: 'meo',
  name: 'Mèo Mây',
  category: 'dong-vat',
  level: 2,
  theme: 'cozy',
  blurb: 'Mèo Mây thích nghiêng đầu, vẫy đuôi và kêu meo meo.',
  bg: '#FFE9F2',
  hover: 0,
  scenery: [
    region(ellipse(500, 1040, 400, 92), '#C4B5FD'),
    ln(ellipse(500, 1040, 330, 60)),
    region(circle(160, 940, 72), '#FF8A4C'),
    ln(curve([[110, 900], [160, 930], [205, 905]]) + curve([[100, 950], [160, 975], [220, 945]])),
    ln(curve([[220, 960], [280, 1000], [300, 1080]])),
    region(heart(840, 200, 34), '#FF9EC0'),
    region(heart(150, 260, 26), '#FF9EC0'),
    region(star(880, 520, 26), '#FFD84D'),
  ],
  parts: [
    {
      id: 'tail', bone: 'tail1', puff: 0.75, color: '#FFB020',
      d: tube([[640, 905], [762, 885], [832, 785], [822, 665], [762, 622]], 74, 58),
      chain: { bones: ['tail1', 'tail2'], tip: [762, 622] },
      details: [ln(line([[790, 860], [760, 830]])), ln(line([[835, 740], [800, 735]]))],
    },
    { id: 'earL', bone: 'earL', puff: 0.5, color: '#FFB020', d: blob(earL), details: [region(blob([[352, 350], [358, 260], [380, 232], [420, 282], [450, 330]]), '#FFB3CF')] },
    { id: 'earR', bone: 'earR', puff: 0.5, color: '#FFB020', d: blob(mirror(earL)), details: [region(blob(mirror([[352, 350], [358, 260], [380, 232], [420, 282], [450, 330]])), '#FFB3CF')] },
    {
      id: 'body', bone: 'body', puff: 1, color: '#FFB020',
      d: blob([[500, 560], [620, 600], [692, 722], [712, 862], [662, 962], [500, 992], [338, 962], [288, 862], [308, 722], [380, 600]]),
      details: [region(ellipse(500, 815, 118, 138), '#FFF1D6'), ln(line([[330, 760], [370, 770]])), ln(line([[670, 760], [630, 770]]))],
    },
    {
      id: 'paws', bone: 'root', puff: 0.7, color: '#FFB020',
      d: ellipse(428, 976, 62, 38) + ellipse(572, 976, 62, 38),
      details: [ln(line([[418, 960], [418, 990]]) + line([[440, 960], [440, 990]]) + line([[562, 960], [562, 990]]) + line([[584, 960], [584, 990]]))],
    },
    {
      id: 'head', bone: 'head', puff: 1, color: '#FFB020',
      d: blob([[500, 252], [642, 282], [732, 382], [742, 482], [692, 582], [580, 632], [420, 632], [308, 582], [258, 482], [268, 382], [358, 282]]),
      details: [
        region(tube([[370, 628], [500, 662], [630, 628]], 34, 34), '#4FB3FF'),
        region(circle(500, 676, 28), '#FFD84D'),
        ln(line([[478, 680], [522, 680]])),
        ...eye(420, 452, 28, 36), ...eye(580, 452, 28, 36),
        ink(blob([[484, 505], [516, 505], [500, 524]])),
        ln(curve([[460, 540], [478, 556], [500, 538]]) + curve([[500, 538], [522, 556], [540, 540]])),
        ln(line([[380, 520], [300, 505]]) + line([[380, 542], [302, 552]]) + line([[620, 520], [700, 505]]) + line([[620, 542], [698, 552]])),
        region(ellipse(370, 545, 28, 16), '#FF9EC0'), region(ellipse(630, 545, 28, 16), '#FF9EC0'),
        ln(line([[500, 290], [500, 330]]) + line([[460, 298], [468, 335]]) + line([[540, 298], [532, 335]])),
      ],
    },
  ],
  bones: [
    { name: 'root', x: 500, y: 995 },
    { name: 'body', parent: 'root', x: 500, y: 780 },
    { name: 'head', parent: 'body', x: 500, y: 610 },
    { name: 'earL', parent: 'head', x: 390, y: 330 },
    { name: 'earR', parent: 'head', x: 610, y: 330 },
    { name: 'tail1', parent: 'body', x: 650, y: 905 },
    { name: 'tail2', parent: 'tail1', x: 830, y: 770 },
  ],
  idle(t, B) {
    B.tail1.rotation.z += S(t * 1.8) * 0.18;
    B.tail2.rotation.z += S(t * 1.8 - 0.8) * 0.4;
    B.head.rotation.z += S(t * 1.1) * 0.09;
    const twitch = Math.max(0, S(t * 0.9) - 0.92) * 8;
    B.earL.rotation.z += twitch * 0.3;
    B.earR.rotation.z += -twitch * 0.3;
    B.body.scale.x = 1 + 0.02 * S(t * 2.2);
  },
  special: {
    label: 'Meo meo', icon: 'heart', dur: 1.2, sound: 'meow', particles: 'hearts', at: 'head',
    update(p, B) {
      const k = Math.sin(p * Math.PI);
      B.head.rotation.z += k * 0.25;
      B.earL.rotation.z += k * 0.2;
      B.earR.rotation.z += -k * 0.2;
      B.tail2.rotation.z += k * 0.6;
    },
  },
};

// ---------------------------------------------------------------- chick
const wingL = [[302, 582], [222, 642], [190, 732], [240, 782], [312, 722]];
const chick = {
  id: 7,
  slug: 'ga-con',
  name: 'Gà con Bông',
  category: 'dong-vat',
  level: 1,
  theme: 'meadow',
  blurb: 'Bông vừa chui ra khỏi vỏ trứng và muốn chiêm chiếp chào bạn.',
  bg: '#E3F6FF',
  hover: 0,
  scenery: [
    region(hills(1050, 3), '#A8E6A1'),
    region(circle(860, 150, 66), '#FFD84D'),
    region(cloud(200, 170, 230), '#FFFFFF'),
    stem(120, 1250, 1080), ...flowerItems(120, 1060, 56, '#FF9EC0', '#FFD84D'),
    stem(890, 1250, 1100), ...flowerItems(890, 1080, 52, '#C4B5FD', '#FFD84D'),
    ln(curve([[300, 1170], [310, 1130], [322, 1170]]) + curve([[660, 1190], [672, 1150], [684, 1190]])),
  ],
  parts: [
    {
      id: 'tuft', bone: 'tuft', puff: 0.45, color: '#FFB020',
      d: ellipse(466, 318, 22, 52, -25) + ellipse(500, 298, 22, 60, 0) + ellipse(534, 318, 22, 52, 25),
      details: [],
    },
    {
      id: 'body', bone: 'body', puff: 1, color: '#FFE066',
      d: ellipse(500, 622, 262, 292),
      details: [
        ...eye(430, 522, 22, 28), ...eye(570, 522, 22, 28),
        region('M455 580Q500 548 545 580Q500 628 455 580Z', '#FF8A4C'),
        ln(line([[462, 582], [538, 582]])),
        region(ellipse(385, 592, 30, 18), '#FF9EC0'), region(ellipse(615, 592, 30, 18), '#FF9EC0'),
        ln(curve([[440, 680], [470, 700], [500, 680]]) + curve([[500, 680], [530, 700], [560, 680]])),
      ],
    },
    { id: 'wingL', bone: 'wingL', puff: 0.5, color: '#FFD23F', d: blob(wingL), details: [ln(curve([[230, 700], [260, 720], [290, 700]]))] },
    { id: 'wingR', bone: 'wingR', puff: 0.5, color: '#FFD23F', d: blob(mirror(wingL)), details: [ln(curve(mirror([[230, 700], [260, 720], [290, 700]])))] },
    {
      id: 'shell', bone: 'root', puff: 0.9, color: '#FFFFFF',
      d: 'M246 760L298 718L342 772L392 718L442 772L500 718L558 772L608 718L658 772L702 718L754 760Q770 900 640 962L360 962Q230 900 246 760Z',
      details: [region(circle(350, 860, 22), '#9EE3FF'), region(circle(650, 880, 26), '#FF9EC0'), region(circle(500, 900, 18), '#C4B5FD')],
    },
  ],
  bones: [
    { name: 'root', x: 500, y: 962 },
    { name: 'body', parent: 'root', x: 500, y: 760 },
    { name: 'tuft', parent: 'body', x: 500, y: 345 },
    { name: 'wingL', parent: 'body', x: 302, y: 610 },
    { name: 'wingR', parent: 'body', x: 698, y: 610 },
  ],
  idle(t, B) {
    const hop = Math.abs(S(t * 3));
    B.body.position.y += hop * 0.06;
    B.body.scale.y = 1 + (hop - 0.5) * 0.04;
    const burst = Math.max(0, S(t * 1.1)) ** 6;
    B.wingL.rotation.z += -S(t * 16) * 0.35 * burst - 0.05;
    B.wingR.rotation.z += S(t * 16) * 0.35 * burst + 0.05;
    B.tuft.rotation.z += S(t * 3.2) * 0.15;
  },
  special: {
    label: 'Chiêm chiếp', icon: 'heart', dur: 1.2, sound: 'chirp', particles: 'hearts', at: 'tuft',
    update(p, B, t) {
      const k = Math.sin(p * Math.PI);
      B.wingL.rotation.z += -S(t * 30) * 0.5 * k;
      B.wingR.rotation.z += S(t * 30) * 0.5 * k;
      B.body.position.y += k * 0.25;
    },
  },
};

// ---------------------------------------------------------------- free drawing
const free = {
  id: 30,
  slug: 'tu-ve',
  name: 'Bé tự sáng tạo',
  category: 'tu-do',
  level: 3,
  theme: 'garden',
  blurb: 'Trang trống: bé tự vẽ một nhân vật thật to, tô màu rồi quét để bạn ấy nhảy múa.',
  bg: '#FFFFFF',
  hover: 0,
  free: true,
  header: 'Vẽ một nhân vật thật to, nét liền và kín',
  scenery: [],
  parts: [],
  bones: [],
  idle(t, B) {
    if (!B.b1) return;
    B.b1.rotation.z += S(t * 2.4) * 0.07;
    B.b2.rotation.z += S(t * 2.4 - 0.7) * 0.1;
    B.b3.rotation.z += S(t * 2.4 - 1.4) * 0.14;
    B.root.position.y += Math.abs(S(t * 2.4)) * 0.05;
  },
  special: {
    label: 'Nhảy múa', icon: 'sparkle', dur: 1.6, sound: 'magic', particles: 'stars', at: 'b3',
    update(p, B, t) {
      const k = Math.sin(p * Math.PI);
      if (!B.b1) return;
      B.b1.rotation.z += S(t * 14) * 0.15 * k;
      B.b2.rotation.z += S(t * 14 - 1) * 0.2 * k;
      B.b3.rotation.z += S(t * 14 - 2) * 0.25 * k;
    },
  },
};

export const CHARACTERS = [whale, dino, butterfly, octopus, rocket, cat, chick, free];

export const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dong-vat', label: 'Động vật' },
  { id: 'bien', label: 'Biển cả' },
  { id: 'con-trung', label: 'Côn trùng' },
  { id: 'vu-tru', label: 'Vũ trụ' },
  { id: 'tu-do', label: 'Tự sáng tạo' },
];

export const LEVELS = { 1: 'Dễ', 2: 'Vừa', 3: 'Sáng tạo' };

export function byId(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

export function bySlug(slug) {
  return CHARACTERS.find((c) => c.slug === slug) || null;
}
