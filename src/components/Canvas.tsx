import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Annotation, ViewState } from '@/types/annotation';
import { drawAnnotations } from '@/utils/drawUtils';

interface CanvasProps {
  imageUrl: string | null;
  annotations: Annotation[];
  hiddenIds: Set<string>;
  onImageDrop?: (file: File) => void;
  className?: string;
}

export function Canvas({ imageUrl, annotations, hiddenIds, onImageDrop, className }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [viewState, setViewState] = useState<ViewState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了容器
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const isOutside = 
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom;
      if (isOutside) {
        setIsDragOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && onImageDrop) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'].includes(ext || '')) {
        onImageDrop(file);
      }
    }
  }, [onImageDrop]);

  // 加载图片
  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setViewState({ scale: 1, offsetX: 0, offsetY: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 绘制画布
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!image) return;

    ctx.save();
    ctx.drawImage(
      image,
      viewState.offsetX,
      viewState.offsetY,
      image.width * viewState.scale,
      image.height * viewState.scale
    );
    ctx.restore();

    drawAnnotations(ctx, annotations, viewState.scale, viewState.offsetX, viewState.offsetY, hiddenIds);
  }, [image, annotations, viewState, hiddenIds]);

  // 调整画布大小
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // 重绘
  useEffect(() => {
    render();
  }, [render]);

  // 自动适应画布
  const fitToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const scaleX = canvas.width / image.width;
    const scaleY = canvas.height / image.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (canvas.width - image.width * scale) / 2;
    const offsetY = (canvas.height - image.height * scale) / 2;

    setViewState({ scale, offsetX, offsetY });
  }, [image]);

  useEffect(() => {
    if (image) {
      fitToCanvas();
    }
  }, [image, fitToCanvas]);

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, viewState.scale * delta));

    const newOffsetX = mouseX - (mouseX - viewState.offsetX) * (newScale / viewState.scale);
    const newOffsetY = mouseY - (mouseY - viewState.offsetY) * (newScale / viewState.scale);

    setViewState({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  // 拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewState.offsetX, y: e.clientY - viewState.offsetY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewState({
      ...viewState,
      offsetX: e.clientX - dragStart.x,
      offsetY: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 缩放控制
  const zoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const newScale = Math.min(10, viewState.scale * 1.2);
    const newOffsetX = centerX - (centerX - viewState.offsetX) * (newScale / viewState.scale);
    const newOffsetY = centerY - (centerY - viewState.offsetY) * (newScale / viewState.scale);
    setViewState({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const zoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const newScale = Math.max(0.1, viewState.scale / 1.2);
    const newOffsetX = centerX - (centerX - viewState.offsetX) * (newScale / viewState.scale);
    const newOffsetY = centerY - (centerY - viewState.offsetY) * (newScale / viewState.scale);
    setViewState({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const resetView = () => {
    fitToCanvas();
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-muted/30", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖放提示遮罩 */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm font-medium text-primary">松开以加载图片</p>
          </div>
        </div>
      )}

      {/* 画布 */}
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0", isDragOver ? "pointer-events-none" : "cursor-grab active:cursor-grabbing")}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* 空状态 */}
      {!imageUrl && !isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <svg
              className="mx-auto h-16 w-16 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm">拖放图片到此处</p>
          </div>
        </div>
      )}

      {/* 缩放控制 */}
      {imageUrl && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg bg-background/90 p-1 shadow-lg backdrop-blur-sm z-10">
          <button
            onClick={zoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="缩小"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="min-w-[60px] text-center text-xs text-muted-foreground">
            {Math.round(viewState.scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="放大"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={resetView}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="适应窗口"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
