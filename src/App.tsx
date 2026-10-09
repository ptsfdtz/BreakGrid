import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Crosshair, Download, Expand, Heart, Maximize2, Pause, Play, RefreshCw, RotateCcw, Settings2, Trophy, Vibrate, Volume2, X, Zap } from 'lucide-react';
import { Engine, type Snapshot } from './game/engine';
import { LEVELS, WIDTH } from './game/levels';
import { MapPreview } from './MapPreview';
import { render } from './game/render';
import { recordBest, loadSave, persist, type Save } from './game/storage';
import { Sound } from './game/audio';
import { usePwa } from './pwa';

const number = (n: number) => n.toLocaleString('en-US');
export default function App() {
  const pwa = usePwa();
  const [save, setSave] = useState<Save>(loadSave);
  const [level, setLevel] = useState(0);
  const game = useRef(new Engine(0));
  const [state, setState] = useState<Snapshot>(() => game.current.snapshot());
  const [help, setHelp] = useState(false);
  const [chooser, setChooser] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  const sound = useRef(new Sound());
  const settings = useRef(save);
  const [fullscreen, setFullscreen] = useState(false);
  const completed = useRef(false);
  const controls = useRef({ left: false, right: false });
  const dragging = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number; ready: boolean } | null>(null);
  const modalOpen = useRef(false);
  modalOpen.current = help || chooser;

  useEffect(() => { settings.current = save; persist(save); }, [save]);
  const sync = useCallback(() => setState(game.current.snapshot()), []);
  const chooseMap = (index: number) => {
    game.current = new Engine(index); completed.current = false;
    setLevel(index); setChooser(false); sync();
  };
  const start = () => { sound.current.unlock(); game.current.paddle = game.current.target; game.current.launch(); sync(); };
  const pause = () => { game.current.pause(); sync(); };
  const resume = () => { sound.current.unlock(); game.current.resume(); sync(); };
  const openHelp = () => { pause(); setHelp(true); };

  useEffect(() => {
    if (!help && !chooser) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [help, chooser]);

  useEffect(() => {
    const node = canvas.current!;
    const container = arena.current!;
    const ctx = node.getContext('2d')!;
    let last = 0, accumulator = 0, update = 0, frame = 0;
    let previousWidth = 0, previousHeight = 0;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      node.width = Math.round(width * ratio); node.height = Math.round(height * ratio);
      if (previousWidth && (Math.abs(previousWidth - width) > 1 || Math.abs(previousHeight - height) > 1)) { game.current.pause(); sync(); }
      previousWidth = width; previousHeight = height;
    });
    observer.observe(container);
    const loop = (time: number) => {
      const g = game.current;
      g.onEvent = event => {
        if (settings.current.sound) sound.current.play(event);
        if (settings.current.vibration && ['catch', 'skill', 'life', 'win'].includes(event)) navigator.vibrate?.(event === 'win' ? [25, 35, 45] : 12);
      };
      const delta = last ? Math.min(0.05, (time - last) / 1000) : 0;
      last = time; accumulator += delta;
      while (accumulator >= 1 / 120) {
        if (g.status === 'ready') g.paddle = g.target;
        if (g.status === 'ready' || g.status === 'playing') {
          const direction = Number(controls.current.right) - Number(controls.current.left);
          if (direction) g.move(g.target + direction * 440 / 120);
        }
        g.step(1 / 120); accumulator -= 1 / 120;
      }
      render(ctx, g, node.width, node.height);
      if (time - update > 90) { setState(g.snapshot()); update = time; }
      if (g.status === 'won' && !completed.current) {
        completed.current = true;
        setSave(previous => recordBest(previous, g.level, g.score));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const visibility = () => { if (document.hidden) { controls.current = { left: false, right: false }; game.current.pause(); sync(); } };
    const blur = () => { controls.current = { left: false, right: false }; game.current.pause(); sync(); };
    const keydown = (e: KeyboardEvent) => {
      if (modalOpen.current) { if (e.key === 'Escape') { setHelp(false); setChooser(false); } return; }
      if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
      if (['ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft') controls.current.left = true;
      if (e.key === 'ArrowRight') controls.current.right = true;
      if (e.repeat) return;
      if (e.key === ' ') { sound.current.unlock(); if (game.current.status === 'ready') game.current.launch(); else if (game.current.status === 'playing') game.current.pause(); else if (game.current.status === 'paused') game.current.resume(); }
      if (e.key === 'Escape') game.current.pause();
      sync();
    };
    const keyup = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') controls.current.left = false; if (e.key === 'ArrowRight') controls.current.right = false; };
    const full = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur); window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); document.addEventListener('fullscreenchange', full);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); document.removeEventListener('fullscreenchange', full); };
  }, [sync]);

  const position = (clientX: number) => { const rect = canvas.current!.getBoundingClientRect(); game.current.move((clientX - rect.left) / rect.width * WIDTH); };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setFullscreen(Boolean(document.fullscreenElement)); }
  };
  return <div className="minimal-game">
    <header className="game-header">
      <span className="brand-mark" aria-label="方块破坏王"><i/><i/><i/><i/></span>
      <button className="level-select" onClick={() => { pause(); setChooser(true); }} aria-label="选择地图">{String(level + 1).padStart(2, '0')}<span>/ {LEVELS.length}</span><ChevronRight size={13}/></button>
      <div className="header-actions">
        <button className="icon-button" onClick={openHelp} aria-label="设置"><Settings2 size={18}/></button>
        {document.fullscreenEnabled && <button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label="全屏">{fullscreen ? <Maximize2 size={17}/> : <Expand size={17}/>}</button>}
        <button className="icon-button" onClick={pause} disabled={state.status !== 'playing'} aria-label="暂停"><Pause size={19}/></button>
      </div>
    </header>
    <main className="game-main">
      <div className="board-card">
        <div className="hud">
          <strong className="score" aria-label={`得分 ${state.score}`}>{number(state.score).padStart(6, '0')}</strong>
          <span className="ball-count" aria-label={`${state.balls} 球在场`}><i/>{state.balls}</span>
          <div className="lives" aria-label={`${state.lives} 次机会`}>{[0,1,2].map(i => <Heart key={i} size={14} className={i < state.lives ? 'alive' : ''} fill={i < state.lives ? 'currentColor' : 'none'}/>)}</div>
        </div>
        <div className="arena" ref={arena}
          onPointerDown={e => { if (e.target !== e.currentTarget && !(e.target instanceof HTMLCanvasElement)) return; if (dragging.current === null) { dragging.current = e.pointerId; pressStart.current = { x: e.clientX, y: e.clientY, ready: game.current.status === 'ready' }; e.currentTarget.setPointerCapture(e.pointerId); position(e.clientX); } }}
          onPointerMove={e => { if (e.pointerType === 'mouse' || dragging.current === e.pointerId) position(e.clientX); }}
          onPointerUp={e => { if (dragging.current !== e.pointerId) return; const press = pressStart.current; dragging.current = null; pressStart.current = null; if (press?.ready && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) start(); }} onPointerCancel={() => { dragging.current = null; pressStart.current = null; }}>
          <canvas ref={canvas} aria-label={`地图 ${level + 1}，左右拖动控制挡板`}/>
          {state.combo >= 5 && state.status === 'playing' && <div className="combo"><strong>{state.combo}</strong><Zap size={16}/></div>}
          {state.status === 'paused' && !help && !chooser && <div className="board-overlay"><Pause className="overlay-icon" size={32}/><button className="primary" onClick={resume} aria-label="继续"><Play size={20} fill="currentColor"/></button><button className="icon-button retry-button" onClick={() => chooseMap(level)} aria-label="重来"><RotateCcw size={20}/></button></div>}
          {(state.status === 'lost' || state.status === 'won' && state.wonTime > 0.7) && <div className="board-overlay">
            {state.status === 'won' ? <Trophy className="overlay-icon success" size={35}/> : <RotateCcw className="overlay-icon" size={32}/>}
            <div className="result-score" aria-label={`得分 ${state.score}`}>{number(state.score)}</div>
            <button className="primary" aria-label="重玩地图" onClick={() => chooseMap(level)}><RotateCcw size={20}/></button>
            <button className="icon-button" aria-label="选择地图" onClick={() => setChooser(true)}><ChevronRight size={20}/></button>
          </div>}
        </div>
        <div className="progress-track" role="progressbar" aria-label="绿块清除进度" aria-valuenow={Math.floor(state.progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${state.progress * 100}%` }}/></div>
      </div>
    </main>
    <footer className="game-controls">
      {state.status === 'ready' ? <button className="primary" onClick={start} aria-label="发射"><Play size={20} fill="currentColor"/></button> : <div className="auto-skills" aria-label="技能数量"><span className="split-skill"><SplitIcon/><span>×{state.split}</span></span><span className="volley-skill"><Crosshair size={22}/><span>×{state.volley}</span></span></div>}
    </footer>
    {(help || chooser) && <div className="modal-backdrop" onClick={() => { setHelp(false); setChooser(false); }}><section className={`modal ${chooser ? 'map-modal' : ''}`} role="dialog" aria-modal="true" aria-label={help ? '设置' : '选择地图'} onClick={e => e.stopPropagation()}>
      <button className="modal-close icon-button" aria-label="关闭" onClick={() => { setHelp(false); setChooser(false); }}><X size={20}/></button>
      {chooser ? <div className="level-list">{LEVELS.map((item, i) => <button key={i} aria-label={`地图 ${i + 1} ${item.name}`} aria-pressed={i === level} className={`level-item ${i === level ? 'selected' : ''}`} onClick={() => chooseMap(i)}><MapPreview index={i}/><span className="map-caption"><span>{String(i + 1).padStart(2, '0')}</span><strong>{item.name}</strong></span></button>)}</div> : <>
        {!pwa.standalone && <button className="setting-row" aria-label="安装到手机桌面" title="安装到手机桌面" onClick={() => { void pwa.install(); }}><Download size={18}/><ChevronRight size={15}/></button>}
        {pwa.installHelp && !pwa.standalone && <p className="install-help">{pwa.isIos ? 'Safari → 分享 → 添加到主屏幕' : '浏览器菜单 → 安装应用 / 添加到主屏幕'}</p>}
        {pwa.updateReady && <button className="setting-row" aria-label="更新应用" title="更新应用" onClick={() => { pause(); void pwa.update(); }}><RefreshCw size={18}/><ChevronRight size={15}/></button>}
        <button className="setting-row" role="switch" aria-label="音效" aria-checked={save.sound} onClick={() => { sound.current.unlock(); setSave(s => ({ ...s, sound: !s.sound })); }}><Volume2 size={18}/><span className={`toggle ${save.sound ? 'on' : ''}`}><i/></span></button>
        <button className="setting-row" role="switch" aria-label="震动" aria-checked={save.vibration} onClick={() => setSave(s => ({ ...s, vibration: !s.vibration }))}><Vibrate size={18}/><span className={`toggle ${save.vibration ? 'on' : ''}`}><i/></span></button>
        <button className="setting-row" aria-label="重来" onClick={() => { setHelp(false); chooseMap(level); }}><RotateCcw size={18}/><ChevronRight size={15}/></button>
      </>}
    </section></div>}
  </div>;
}
function SplitIcon() { return <svg width="25" height="25" viewBox="0 0 25 25" fill="none" aria-hidden="true"><rect x="2" y="2" width="21" height="21" rx="5" fill="currentColor"/><g fill="#000"><circle cx="12.5" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="17" cy="16" r="2"/></g></svg>; }
