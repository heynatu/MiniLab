// "Bé Lab", the MiniLab mascot: a happy little flask. Original artwork.
export const MASCOT_SVG = `
<svg class="mascot" viewBox="0 0 120 132" role="img" aria-label="Bé Lab, linh vật MiniLab">
  <defs>
    <clipPath id="ml-flask-clip">
      <path d="M47 44 L47 56 L21 98 Q15 112 30 116 L90 116 Q105 112 99 98 L73 56 L73 44 Z"/>
    </clipPath>
  </defs>
  <g class="mascot-bubbles">
    <circle class="b1" cx="56" cy="14" r="4.5" fill="#FFC93C" stroke="#2B2A4C" stroke-width="2.5"/>
    <circle class="b2" cx="69" cy="6" r="3" fill="#4FB3FF" stroke="#2B2A4C" stroke-width="2.5"/>
    <circle class="b3" cx="64" cy="24" r="2.5" fill="#3DD6A3" stroke="#2B2A4C" stroke-width="2"/>
  </g>
  <g class="mascot-body">
    <path d="M47 44 L47 56 L21 98 Q15 112 30 116 L90 116 Q105 112 99 98 L73 56 L73 44 Z" fill="#E6F5FF"/>
    <g clip-path="url(#ml-flask-clip)">
      <path class="mascot-liquid" d="M0 84 Q15 76 30 84 T60 84 T90 84 T120 84 T150 84 L150 132 L0 132 Z" fill="#FF7AA8"/>
      <circle cx="40" cy="104" r="3" fill="#FFE1EC"/>
      <circle cx="78" cy="96" r="2" fill="#FFE1EC"/>
    </g>
    <path d="M47 44 L47 56 L21 98 Q15 112 30 116 L90 116 Q105 112 99 98 L73 56 L73 44 Z" fill="none" stroke="#2B2A4C" stroke-width="4" stroke-linejoin="round"/>
    <rect x="40" y="34" width="40" height="12" rx="6" fill="#9B7BFF" stroke="#2B2A4C" stroke-width="4"/>
    <path d="M30 98 Q34 88 40 80" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.9"/>
    <g class="mascot-face">
      <ellipse class="eye" cx="49" cy="74" rx="4.5" ry="5.5" fill="#2B2A4C"/>
      <ellipse class="eye" cx="71" cy="74" rx="4.5" ry="5.5" fill="#2B2A4C"/>
      <circle cx="50.5" cy="72" r="1.6" fill="#fff"/>
      <circle cx="72.5" cy="72" r="1.6" fill="#fff"/>
      <ellipse cx="40" cy="84" rx="5" ry="3" fill="#FF7AA8" opacity="0.55"/>
      <ellipse cx="80" cy="84" rx="5" ry="3" fill="#FF7AA8" opacity="0.55"/>
      <path d="M54 82 Q60 89 66 82" stroke="#2B2A4C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    </g>
  </g>
</svg>`;

export const WORDMARK_COLORS = ['#FF7AA8', '#FFB020', '#4FB3FF', '#3DD6A3', '#9B7BFF', '#FF8A4C', '#FF7AA8'];

export function wordmarkHTML(text = 'MiniLab') {
  return [...text].map((ch, i) => `<span style="color:${WORDMARK_COLORS[i % WORDMARK_COLORS.length]}">${ch}</span>`).join('');
}
