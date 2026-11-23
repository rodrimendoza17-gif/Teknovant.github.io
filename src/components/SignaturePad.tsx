import React, { useRef, useState, useEffect, useCallback } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  initialSignature?: string;
  title?: string;
  height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  initialSignature,
  title = 'Firma del Cliente',
  height = 160
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!initialSignature);
  const [currentSignature, setCurrentSignature] = useState<string | undefined>(initialSignature);

  // Setup canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // dark ink

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture might already be released
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setCurrentSignature(dataUrl);
    onSave(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    setCurrentSignature(undefined);
    onSave('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-600" />
          {title}
        </span>
        {hasDrawn && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 text-xs px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar trazo
          </button>
        )}
      </div>

      <div className="relative border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="cursor-crosshair w-full block bg-white"
        />

        {/* Visual guide line */}
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-zinc-200 flex justify-between text-[10px] text-zinc-400">
          <span>X___________________________</span>
          <span>Firme aquí con el dedo o lápiz</span>
        </div>

        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 text-xs">
            Toque y deslice para firmar
          </div>
        )}
      </div>

      {hasDrawn && (
        <div className="flex items-center justify-end text-[11px] text-emerald-600 dark:text-emerald-400 gap-1 font-medium">
          <Check className="w-3.5 h-3.5" />
          Firma registrada
        </div>
      )}
    </div>
  );
};
