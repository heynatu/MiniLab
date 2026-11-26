// A4 printing through the browser's own print dialog (also "Save as PDF").
import { h } from '../../shared/h.js';
import { pageSVG } from './page.js';

/** Prints the given nodes, each one an A4 sheet. Returns the sheet count. */
export async function printNodes(nodes) {
  document.getElementById('print-root')?.remove();
  const root = h('div', { id: 'print-root', 'aria-hidden': 'true' }, nodes);
  document.body.append(root);
  document.body.classList.add('printing');
  try { await document.fonts?.ready; } catch { /* fonts optional */ }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const done = () => {
    document.body.classList.remove('printing');
    root.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Some mobile browsers never fire afterprint.
  setTimeout(() => { if (document.body.contains(root)) done(); }, 60000);
  return nodes.length;
}

/**
 * jobs: [{ tpl, copies }]
 * opts: { label, withSample }
 */
export function printPages(jobs, { label = '', withSample = false } = {}) {
  const sheets = [];
  for (const { tpl, copies } of jobs) {
    if (withSample) sheets.push(sheet(pageSVG(tpl, { colored: true, label: 'Bản mẫu' })));
    const svg = pageSVG(tpl, { label });
    for (let i = 0; i < copies; i++) sheets.push(sheet(svg));
  }
  return printNodes(sheets);
}

function sheet(svg) {
  const el = h('div', { class: 'print-sheet' });
  el.innerHTML = svg;
  return el;
}
