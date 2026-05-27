/**
 * SignaturePad — Lightweight touch/mouse signature canvas.
 * Exposes getDataURL() and clear() via ref. No external deps.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const SignaturePad = forwardRef(function SignaturePad({ height = 180 }, ref) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(false);

  // Setup high-DPI canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const onStart = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
    setHasInk(true);
  };

  const onMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pt = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const onEnd = () => { drawingRef.current = false; };

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (!hasInk) return null;
      return canvasRef.current.toDataURL("image/png");
    },
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasInk(false);
    },
    isEmpty: () => !hasInk,
  }));

  return (
    <div className="relative">
      <canvas
        data-testid="signature-pad-canvas"
        ref={canvasRef}
        style={{ height, touchAction: "none" }}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      />
      {!hasInk && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
          Sign here with your finger
        </div>
      )}
    </div>
  );
});

export default SignaturePad;
