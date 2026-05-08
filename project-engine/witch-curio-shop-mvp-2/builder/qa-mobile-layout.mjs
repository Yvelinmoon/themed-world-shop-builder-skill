import { readFile } from 'node:fs/promises';
import path from 'node:path';
const target = process.argv[2] || process.cwd();
const css = await readFile(path.join(target, 'styles.css'), 'utf8');
const html = await readFile(path.join(target, 'index.html'), 'utf8').catch(() => '');
  const checks = {
  mobilePatchPresent: css.includes('Project-level mobile gameplay layout'),
  mobileRefinePresent: css.includes('mobile gameplay refinement v2') && css.includes('mobile gameplay refinement v3'),
  mobileBoardFirst: /@media \(max-width: 760px\) and \(pointer: coarse\)[\s\S]*grid-template-areas:\s*"top"\s*"board"\s*"side"/.test(css),
  layoutBoardBeforeSide: /\.layout \{[\s\S]*grid-template-areas:\s*"board"\s*"side"/.test(css) || /grid-template-areas:\s*"assistant"\s*"board"\s*"task"/.test(css),
  squareBoard: css.includes('aspect-ratio: 1 / 1') && css.includes('--mobile-board-size: min(92vw'),
  decorHidden: css.includes('.shop-decor-sticker') && css.includes('display: none !important'),
  statusCollapsed: css.includes('.status-bar::before') && css.includes('快捷菜单') && css.includes('pointer-events: none'),
  trashOwnRow: css.includes('.play-panel .play-footer') && (css.includes('position: static') || css.includes('display: none')),
  trashHiddenMobile: css.includes('.play-panel .play-footer') && css.includes('display: none'),
  headerInfoKept: css.includes('.brand-rank-label') && css.includes('display: inline-flex') && css.includes('.brand-level-line') && css.includes('display: flex'),
  assistantCompact: css.includes('grid-area: assistant') && css.includes('grid-template-columns: 42px'),
  taskDrawer: css.includes('grid-area: task') && css.includes('max-height: 44px'),
  boardSizeMobile: css.includes('--mobile-board-size') && css.includes('width: var(--mobile-board-size)'),
  sidebarSecondary: css.includes('.task-panel') && (css.includes('max-height: 34dvh') || css.includes('max-height: 44px')),
  trashAnchored: css.includes('.play-panel .play-footer'),
  noHorizontalOverflow: css.includes('overflow-x: hidden'),
  noUndefined: !/^undefined\s*$/m.test(css + '\n' + html),
};
const report = { status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks };
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exit(1);
