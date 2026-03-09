import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IconButton, Tooltip, Box, Slider } from '@mui/material';
import {
  Draw,
  HorizontalRule,
  Rectangle,
  Circle,
  ChangeHistory,
  TextFields,
  AutoFixOff,
  Undo,
  DeleteForever,
  FormatColorFill,
  Diamond,
  ArrowForward,
  SwapHoriz,
} from '@mui/icons-material';

type Tool =
  | 'pen' | 'line' | 'dashed-line' | 'arrow' | 'double-arrow'
  | 'rectangle' | 'circle' | 'triangle' | 'diamond'
  | 'text' | 'eraser';

interface Point { x: number; y: number }

interface BaseElement {
  color: string;
  lineWidth: number;
  fillColor?: string;
  dashed?: boolean;
}

interface PenElement extends BaseElement { type: 'pen'; points: Point[] }
interface EraserElement extends BaseElement { type: 'eraser'; points: Point[] }
interface LineElement extends BaseElement { type: 'line'; start: Point; end: Point }
interface ArrowElement extends BaseElement { type: 'arrow'; start: Point; end: Point; double: boolean }
interface RectElement extends BaseElement { type: 'rectangle'; start: Point; end: Point }
interface CircleElement extends BaseElement { type: 'circle'; center: Point; radius: number }
interface TriangleElement extends BaseElement { type: 'triangle'; start: Point; end: Point }
interface DiamondElement extends BaseElement { type: 'diamond'; start: Point; end: Point }
interface TextElement extends BaseElement { type: 'text'; position: Point; content: string; fontSize: number }

type DrawElement =
  | PenElement | EraserElement | LineElement | ArrowElement
  | RectElement | CircleElement | TriangleElement | DiamondElement | TextElement;

interface WhiteboardProps {
  className?: string;
  onElementAdd?: (element: DrawElement) => void;
  onUndo?: () => void;
  onClear?: () => void;
}

// Export DrawElement so App can pass it over DataChannel
export type { DrawElement };

export interface WhiteboardHandle {
  addRemoteElement: (element: DrawElement) => void;
  remoteUndo: () => void;
  remoteClear: () => void;
}

const PRESET_COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];

const TOOL_GROUPS: { tool: Tool; icon: React.ReactNode; label: string }[][] = [
  [
    { tool: 'pen', icon: <Draw fontSize="small" />, label: 'Pen' },
    { tool: 'eraser', icon: <AutoFixOff fontSize="small" />, label: 'Eraser' },
  ],
  [
    { tool: 'line', icon: <HorizontalRule fontSize="small" />, label: 'Line' },
    { tool: 'dashed-line', icon: <HorizontalRule fontSize="small" sx={{ opacity: 0.5 }} />, label: 'Dashed Line' },
    { tool: 'arrow', icon: <ArrowForward fontSize="small" />, label: 'Arrow' },
    { tool: 'double-arrow', icon: <SwapHoriz fontSize="small" />, label: 'Double Arrow' },
  ],
  [
    { tool: 'rectangle', icon: <Rectangle fontSize="small" />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle fontSize="small" />, label: 'Circle' },
    { tool: 'triangle', icon: <ChangeHistory fontSize="small" />, label: 'Triangle' },
    { tool: 'diamond', icon: <Diamond fontSize="small" />, label: 'Diamond' },
  ],
  [
    { tool: 'text', icon: <TextFields fontSize="small" />, label: 'Text' },
  ],
];

const SHAPE_TOOLS: Tool[] = ['rectangle', 'circle', 'triangle', 'diamond'];

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawElement(ctx: CanvasRenderingContext2D, el: DrawElement) {
  ctx.save();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = el.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.dashed) {
    ctx.setLineDash([el.lineWidth * 3, el.lineWidth * 2]);
  }

  switch (el.type) {
    case 'pen':
    case 'eraser': {
      if (el.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        const mid = {
          x: (el.points[i - 1].x + el.points[i].x) / 2,
          y: (el.points[i - 1].y + el.points[i].y) / 2,
        };
        ctx.quadraticCurveTo(el.points[i - 1].x, el.points[i - 1].y, mid.x, mid.y);
      }
      const last = el.points[el.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(el.start.x, el.start.y);
      ctx.lineTo(el.end.x, el.end.y);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(el.start.x, el.start.y);
      ctx.lineTo(el.end.x, el.end.y);
      ctx.stroke();
      const headSize = Math.max(el.lineWidth * 3, 12);
      drawArrowHead(ctx, el.start, el.end, headSize);
      if (el.double) {
        drawArrowHead(ctx, el.end, el.start, headSize);
      }
      break;
    }
    case 'rectangle': {
      const w = el.end.x - el.start.x;
      const h = el.end.y - el.start.y;
      if (el.fillColor) {
        ctx.fillStyle = el.fillColor;
        ctx.fillRect(el.start.x, el.start.y, w, h);
      }
      ctx.strokeRect(el.start.x, el.start.y, w, h);
      break;
    }
    case 'circle': {
      ctx.beginPath();
      ctx.arc(el.center.x, el.center.y, el.radius, 0, Math.PI * 2);
      if (el.fillColor) {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case 'triangle': {
      const topX = (el.start.x + el.end.x) / 2;
      ctx.beginPath();
      ctx.moveTo(topX, el.start.y);
      ctx.lineTo(el.start.x, el.end.y);
      ctx.lineTo(el.end.x, el.end.y);
      ctx.closePath();
      if (el.fillColor) { ctx.fillStyle = el.fillColor; ctx.fill(); }
      ctx.stroke();
      break;
    }
    case 'diamond': {
      const cx = (el.start.x + el.end.x) / 2;
      const cy = (el.start.y + el.end.y) / 2;
      const hw = Math.abs(el.end.x - el.start.x) / 2;
      const hh = Math.abs(el.end.y - el.start.y) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      if (el.fillColor) { ctx.fillStyle = el.fillColor; ctx.fill(); }
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.font = `${el.fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = el.color;
      ctx.fillText(el.content, el.position.x, el.position.y);
      break;
    }
  }
  ctx.restore();
}

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard({ className, onElementAdd, onUndo, onClear }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('');
  const [lineWidth, setLineWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(20);
  const [fontSize, setFontSize] = useState(20);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawElement | null>(null);
  const [textInput, setTextInput] = useState<{ visible: boolean; position: Point }>({
    visible: false, position: { x: 0, y: 0 },
  });
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Refs to hold latest state — used by redrawCanvas so it never goes stale
  const elementsRef = useRef<DrawElement[]>([]);
  const currentElementRef = useRef<DrawElement | null>(null);
  elementsRef.current = elements;
  currentElementRef.current = currentElement;

  // ── DEBUG LOGGING (must be before any code that references it) ──
  const debugLog = useCallback((area: string, msg: string, extra?: Record<string, unknown>) => {
    console.log(
      `%c[WB ${area}]%c ${msg}`,
      'color:#13ec5b;font-weight:bold',
      'color:inherit',
      extra ?? '',
    );
  }, []);

  // Log tool changes
  useEffect(() => {
    debugLog('STATE', `tool changed → "${tool}"`);
  }, [tool, debugLog]);

  useEffect(() => {
    debugLog('STATE', `color="${color}" lineWidth=${lineWidth} eraserSize=${eraserSize} fillEnabled=${fillEnabled} elements=${elements.length}`);
  }, [color, lineWidth, eraserSize, fillEnabled, elements.length, debugLog]);

  // Prevent toolbar pointer events from reaching the canvas
  const stopCanvasEvent = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    debugLog('TOOLBAR', `stopCanvasEvent: type=${e.type} target=${(e.target as HTMLElement).tagName}`);
  }, [debugLog]);

  // Expose imperative methods for remote sync
  useImperativeHandle(ref, () => ({
    addRemoteElement: (element: DrawElement) => {
      setElements(prev => [...prev, element]);
    },
    remoteUndo: () => {
      setElements(prev => prev.slice(0, -1));
    },
    remoteClear: () => {
      setElements([]);
    },
  }));

  const activeColor = tool === 'eraser' ? '#ffffff' : color;
  const activeLineWidth = tool === 'eraser' ? eraserSize : lineWidth;
  const activeFill = fillEnabled && SHAPE_TOOLS.includes(tool) ? (fillColor || color + '33') : undefined;

  // ── On mount: report stacking / hit-test info for debugging ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const toolbar = container.querySelector('[data-wb-toolbar]') as HTMLElement | null;
    if (!toolbar) {
      debugLog('MOUNT', 'toolbar element NOT found (data-wb-toolbar missing)');
      return;
    }
    const toolbarRect = toolbar.getBoundingClientRect();
    debugLog('MOUNT', `toolbar rect: top=${toolbarRect.top.toFixed(0)} left=${toolbarRect.left.toFixed(0)} w=${toolbarRect.width.toFixed(0)} h=${toolbarRect.height.toFixed(0)}`);

    // Hit-test: what element is at the toolbar center?
    const cx = toolbarRect.left + toolbarRect.width / 2;
    const cy = toolbarRect.top + toolbarRect.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    if (topEl) {
      const isToolbar = toolbar.contains(topEl);
      debugLog('MOUNT', `elementFromPoint(${cx.toFixed(0)},${cy.toFixed(0)}): tag=${topEl.tagName} class="${topEl.className?.toString().substring(0, 60)}" isInsideToolbar=${isToolbar}`);
      if (!isToolbar) {
        // Walk up to find what's blocking
        let el: HTMLElement | null = topEl as HTMLElement;
        const chain: string[] = [];
        while (el && chain.length < 5) {
          const cs = window.getComputedStyle(el);
          chain.push(`${el.tagName}.z=${cs.zIndex}.pos=${cs.position}`);
          el = el.parentElement;
        }
        debugLog('MOUNT', `BLOCKING element chain: ${chain.join(' → ')}`);
      }
    }

    // Check first toolbar button hit-test
    const firstBtn = toolbar.querySelector('button');
    if (firstBtn) {
      const btnRect = firstBtn.getBoundingClientRect();
      const bx = btnRect.left + btnRect.width / 2;
      const by = btnRect.top + btnRect.height / 2;
      const btnTopEl = document.elementFromPoint(bx, by);
      const isBtn = firstBtn.contains(btnTopEl!);
      debugLog('MOUNT', `first button hit-test at (${bx.toFixed(0)},${by.toFixed(0)}): topEl=${btnTopEl?.tagName} isButton=${isBtn}`);
      if (!isBtn && btnTopEl) {
        let el2: HTMLElement | null = btnTopEl as HTMLElement;
        const chain2: string[] = [];
        while (el2 && chain2.length < 6) {
          const cs2 = window.getComputedStyle(el2);
          chain2.push(`${el2.tagName}(z=${cs2.zIndex},pos=${cs2.position},pe=${cs2.pointerEvents},class="${el2.className?.toString().substring(0, 40)}")`);
          el2 = el2.parentElement;
        }
        debugLog('MOUNT', `BLOCKING first button: ${chain2.join(' → ')}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable redrawCanvas — reads from refs so it never changes identity
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const el of elementsRef.current) drawElement(ctx, el);
    if (currentElementRef.current) drawElement(ctx, currentElementRef.current);
  }, []);

  // Trigger redraw when state changes
  useEffect(() => { redrawCanvas(); }, [elements, currentElement, redrawCanvas]);

  // ResizeObserver — created once, never reconnected
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
        redrawCanvas();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawCanvas]);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const targetTag = (e.target as HTMLElement).tagName;
    const isCanvas = e.target === canvasRef.current;
    debugLog('CANVAS', `mouseDown: target=${targetTag} isCanvas=${isCanvas} tool="${tool}" clientXY=(${e.clientX},${e.clientY})`);

    // Only handle events that originated on the canvas itself
    if (!isCanvas) {
      debugLog('CANVAS', 'mouseDown IGNORED — target is not canvas');
      return;
    }

    const point = getCanvasPoint(e);
    if (tool === 'text') {
      setTextInput({ visible: true, position: point });
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }
    setIsDrawing(true);

    const base = { color: activeColor, lineWidth: activeLineWidth };
    let el: DrawElement;

    switch (tool) {
      case 'pen': el = { ...base, type: 'pen', points: [point] }; break;
      case 'eraser': el = { ...base, type: 'eraser', color: '#ffffff', lineWidth: eraserSize, points: [point] }; break;
      case 'line': el = { ...base, type: 'line', start: point, end: point }; break;
      case 'dashed-line': el = { ...base, type: 'line', start: point, end: point, dashed: true }; break;
      case 'arrow': el = { ...base, type: 'arrow', start: point, end: point, double: false }; break;
      case 'double-arrow': el = { ...base, type: 'arrow', start: point, end: point, double: true }; break;
      case 'rectangle': el = { ...base, type: 'rectangle', start: point, end: point, fillColor: activeFill }; break;
      case 'circle': el = { ...base, type: 'circle', center: point, radius: 0, fillColor: activeFill }; break;
      case 'triangle': el = { ...base, type: 'triangle', start: point, end: point, fillColor: activeFill }; break;
      case 'diamond': el = { ...base, type: 'diamond', start: point, end: point, fillColor: activeFill }; break;
      default: return;
    }
    setCurrentElement(el);
  }, [tool, activeColor, activeLineWidth, eraserSize, activeFill, getCanvasPoint, debugLog]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;
    const p = getCanvasPoint(e);
    switch (currentElement.type) {
      case 'pen': case 'eraser':
        setCurrentElement({ ...currentElement, points: [...currentElement.points, p] }); break;
      case 'line': setCurrentElement({ ...currentElement, end: p }); break;
      case 'arrow': setCurrentElement({ ...currentElement, end: p }); break;
      case 'rectangle': setCurrentElement({ ...currentElement, end: p }); break;
      case 'circle': {
        const dx = p.x - currentElement.center.x;
        const dy = p.y - currentElement.center.y;
        setCurrentElement({ ...currentElement, radius: Math.sqrt(dx * dx + dy * dy) }); break;
      }
      case 'triangle': setCurrentElement({ ...currentElement, end: p }); break;
      case 'diamond': setCurrentElement({ ...currentElement, end: p }); break;
    }
  }, [isDrawing, currentElement, getCanvasPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentElement) {
      debugLog('CANVAS', `mouseUp IGNORED — isDrawing=${isDrawing} hasCurrentElement=${!!currentElement}`);
      return;
    }
    debugLog('CANVAS', `mouseUp: committing element type="${currentElement.type}" → total elements=${elementsRef.current.length + 1}`);
    setElements(prev => [...prev, currentElement]);
    onElementAdd?.(currentElement);
    setCurrentElement(null);
    setIsDrawing(false);
  }, [isDrawing, currentElement, onElementAdd, debugLog]);

  const handleTextSubmit = useCallback(() => {
    if (textValue.trim()) {
      const el: DrawElement = {
        type: 'text' as const, position: textInput.position, content: textValue,
        color: activeColor, lineWidth, fontSize,
      };
      setElements(prev => [...prev, el]);
      onElementAdd?.(el);
    }
    setTextInput({ visible: false, position: { x: 0, y: 0 } });
    setTextValue('');
  }, [textValue, textInput.position, activeColor, lineWidth, fontSize, onElementAdd]);

  const toolBtnSx = (active: boolean) => ({
    width: 32, height: 32,
    color: active ? '#13ec5b' : 'rgba(255,255,255,0.65)',
    backgroundColor: active ? 'rgba(19,236,91,0.15)' : 'transparent',
    borderRadius: '8px',
    '&:hover': { backgroundColor: active ? 'rgba(19,236,91,0.25)' : 'rgba(255,255,255,0.08)' },
  });

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        aria-label="Drawing whiteboard canvas"
        className="absolute inset-0 w-full h-full"
        style={{ cursor: tool === 'text' ? 'text' : 'crosshair', background: '#ffffff', zIndex: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {textInput.visible && (
        <input
          ref={textInputRef}
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit();
            if (e.key === 'Escape') { setTextInput({ visible: false, position: { x: 0, y: 0 } }); setTextValue(''); }
          }}
          onBlur={handleTextSubmit}
          className="absolute z-20 border-2 border-[#13ec5b] outline-none px-1 bg-white text-black rounded"
          style={{
            left: textInput.position.x, top: textInput.position.y - fontSize / 2,
            fontSize: `${fontSize}px`, fontFamily: "'Inter', sans-serif", minWidth: 100,
          }}
        />
      )}

      {/* Toolbar — horizontal top bar */}
      <Box
        data-wb-toolbar
        onMouseDown={(e) => { debugLog('TOOLBAR-BOX', `mouseDown on toolbar container, target=${(e.target as HTMLElement).tagName}`); stopCanvasEvent(e); }}
        onPointerDown={(e) => { debugLog('TOOLBAR-BOX', `pointerDown on toolbar container, target=${(e.target as HTMLElement).tagName}`); stopCanvasEvent(e); }}
        onClick={(e) => { debugLog('TOOLBAR-BOX', `click on toolbar container, target=${(e.target as HTMLElement).tagName}`); stopCanvasEvent(e); }}
        sx={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1.5, py: 0.75, borderRadius: '14px',
          background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        {/* Tool groups */}
        {TOOL_GROUPS.map((group, gi) => (
          <Box key={gi} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {gi > 0 && <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />}
            {group.map(({ tool: t, icon, label }) => (
              <Tooltip key={t} title={label} placement="bottom" arrow>
                <IconButton onClick={() => { debugLog('CLICK', `tool button clicked: "${t}" (was "${tool}")`); setTool(t); }} sx={toolBtnSx(tool === t)}>{icon}</IconButton>
              </Tooltip>
            ))}
          </Box>
        ))}

        {/* Divider */}
        <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />

        {/* Fill toggle for shapes */}
        {SHAPE_TOOLS.includes(tool) && (
          <Tooltip title={fillEnabled ? 'Fill on' : 'Fill off'} placement="bottom" arrow>
            <IconButton onClick={() => { debugLog('CLICK', `fill toggle (was ${fillEnabled})`); setFillEnabled(f => !f); }} sx={toolBtnSx(fillEnabled)}>
              <FormatColorFill fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Size slider — horizontal */}
        <Tooltip title={tool === 'eraser' ? `Eraser: ${eraserSize}px` : tool === 'text' ? `Font: ${fontSize}px` : `Width: ${lineWidth}px`} placement="bottom">
          <Slider
            size="small"
            value={tool === 'eraser' ? eraserSize : tool === 'text' ? fontSize : lineWidth}
            onChange={(_, v) => {
              if (tool === 'eraser') setEraserSize(v as number);
              else if (tool === 'text') setFontSize(v as number);
              else setLineWidth(v as number);
            }}
            min={tool === 'eraser' ? 5 : tool === 'text' ? 12 : 1}
            max={tool === 'eraser' ? 60 : tool === 'text' ? 72 : 20}
            sx={{
              width: 64, color: '#13ec5b', mx: 0.5,
              '& .MuiSlider-thumb': { width: 12, height: 12 },
              '& .MuiSlider-rail': { opacity: 0.2 },
            }}
          />
        </Tooltip>

        {/* Divider */}
        <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />

        {/* Colors — horizontal row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {PRESET_COLORS.map((c) => (
            <Tooltip key={c} title={c} placement="bottom" arrow>
              <IconButton onClick={() => { debugLog('CLICK', `color picked: ${c}`); setColor(c); }} sx={{
                width: 24, height: 24, minWidth: 24, p: 0,
                border: color === c ? '2px solid #13ec5b' : '2px solid transparent',
                borderRadius: '6px',
                '&:hover': { transform: 'scale(1.15)' },
                transition: 'all 0.15s',
              }}>
                <Box sx={{
                  width: 14, height: 14, borderRadius: '4px', bgcolor: c,
                  border: c === '#ffffff' ? '1px solid rgba(0,0,0,0.15)' : 'none',
                }} />
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Custom" placement="bottom" arrow>
            <Box component="label" sx={{
              width: 24, height: 24, borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
              border: '2px solid rgba(255,255,255,0.15)', position: 'relative',
              background: 'conic-gradient(red,yellow,lime,aqua,blue,magenta,red)',
              flexShrink: 0,
            }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </Box>
          </Tooltip>
        </Box>

        {/* Fill color (when fill enabled) */}
        {fillEnabled && SHAPE_TOOLS.includes(tool) && (
          <Tooltip title="Fill color" placement="bottom" arrow>
            <Box component="label" sx={{
              width: 24, height: 24, borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
              border: '2px solid rgba(255,255,255,0.15)', bgcolor: fillColor || color + '33',
              flexShrink: 0, position: 'relative',
            }}>
              <input type="color" value={fillColor || color}
                onChange={(e) => setFillColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            </Box>
          </Tooltip>
        )}

        {/* Divider */}
        <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />

        {/* Undo & Clear */}
        <Tooltip title="Undo" placement="bottom" arrow>
          <span>
            <IconButton onClick={() => { debugLog('CLICK', `undo (elements=${elements.length})`); setElements(prev => prev.slice(0, -1)); onUndo?.(); }} disabled={!elements.length}
              sx={{ ...toolBtnSx(false), opacity: elements.length ? 1 : 0.3 }}>
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Clear all" placement="bottom" arrow>
          <span>
            <IconButton onClick={() => { debugLog('CLICK', 'clear all'); setElements([]); onClear?.(); }} disabled={!elements.length}
              sx={{ width: 32, height: 32, borderRadius: '8px', color: elements.length ? '#ef4444' : 'rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' } }}>
              <DeleteForever fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </div>
  );
});
