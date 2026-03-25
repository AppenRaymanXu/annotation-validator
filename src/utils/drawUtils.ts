import {
  Annotation,
  AnnotationType,
  BBoxAnnotation,
  PolygonAnnotation,
  PolylineAnnotation,
  PointAnnotation,
  SegmentationAnnotation,
  getLabelColor,
} from '@/types/annotation';

// 绘制矩形框
export function drawBBox(
  ctx: CanvasRenderingContext2D,
  annotation: BBoxAnnotation,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
) {
  const [x, y, width, height] = annotation.bbox;
  const color = annotation.color || getLabelColor(annotation.label, 0);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = color + '20'; // 12.5% 透明度

  const drawX = x * scale + offsetX;
  const drawY = y * scale + offsetY;
  const drawW = width * scale;
  const drawH = height * scale;

  ctx.fillRect(drawX, drawY, drawW, drawH);
  ctx.strokeRect(drawX, drawY, drawW, drawH);

  // 绘制标签
  drawLabel(ctx, annotation.label, drawX, drawY - 5, color, scale);

  ctx.restore();
}

// 绘制多边形
export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  annotation: PolygonAnnotation,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
) {
  if (annotation.points.length < 3) return;

  const color = annotation.color || getLabelColor(annotation.label, 0);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = color + '30';

  ctx.beginPath();
  annotation.points.forEach((point, index) => {
    const drawX = point.x * scale + offsetX;
    const drawY = point.y * scale + offsetY;
    if (index === 0) {
      ctx.moveTo(drawX, drawY);
    } else {
      ctx.lineTo(drawX, drawY);
    }
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 绘制标签
  const firstPoint = annotation.points[0];
  drawLabel(
    ctx,
    annotation.label,
    firstPoint.x * scale + offsetX,
    firstPoint.y * scale + offsetY - 5,
    color,
    scale
  );

  ctx.restore();
}

// 绘制折线
export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  annotation: PolylineAnnotation,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
) {
  if (annotation.points.length < 2) return;

  const color = annotation.color || getLabelColor(annotation.label, 0);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  annotation.points.forEach((point, index) => {
    const drawX = point.x * scale + offsetX;
    const drawY = point.y * scale + offsetY;
    if (index === 0) {
      ctx.moveTo(drawX, drawY);
    } else {
      ctx.lineTo(drawX, drawY);
    }
  });
  ctx.stroke();

  // 绘制端点
  annotation.points.forEach((point) => {
    const drawX = point.x * scale + offsetX;
    const drawY = point.y * scale + offsetY;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 4 / scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // 绘制标签
  const firstPoint = annotation.points[0];
  drawLabel(
    ctx,
    annotation.label,
    firstPoint.x * scale + offsetX,
    firstPoint.y * scale + offsetY - 10,
    color,
    scale
  );

  ctx.restore();
}

// 绘制点
export function drawPoint(
  ctx: CanvasRenderingContext2D,
  annotation: PointAnnotation,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
) {
  const color = annotation.color || getLabelColor(annotation.label, 0);
  const drawX = annotation.point.x * scale + offsetX;
  const drawY = annotation.point.y * scale + offsetY;

  ctx.save();
  
  // 绘制十字
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  const size = 8 / scale;
  
  ctx.beginPath();
  ctx.moveTo(drawX - size, drawY);
  ctx.lineTo(drawX + size, drawY);
  ctx.moveTo(drawX, drawY - size);
  ctx.lineTo(drawX, drawY + size);
  ctx.stroke();

  // 绘制圆形
  ctx.beginPath();
  ctx.arc(drawX, drawY, 5 / scale, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // 绘制标签
  drawLabel(ctx, annotation.label, drawX + 10, drawY - 5, color, scale);

  ctx.restore();
}

// 绘制语义分割 (像素点列表)
export function drawSegmentation(
  ctx: CanvasRenderingContext2D,
  annotation: SegmentationAnnotation,
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0
) {
  if (!annotation.points || annotation.points.length === 0) return;

  const color = annotation.color || getLabelColor(annotation.label, 0);
  const alpha = annotation.alpha ?? 0.6;

  ctx.save();
  
  // 解析颜色
  const rgb = hexToRgb(color);
  if (!rgb) {
    ctx.restore();
    return;
  }

  // 使用 fillRect 绘制每个像素点
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  
  annotation.points.forEach((point) => {
    const drawX = point.x * scale + offsetX;
    const drawY = point.y * scale + offsetY;
    // 每个"像素"在缩放后的尺寸
    ctx.fillRect(drawX, drawY, scale, scale);
  });

  // 绘制标签
  if (annotation.points.length > 0) {
    const firstPoint = annotation.points[0];
    drawLabel(
      ctx,
      annotation.label,
      firstPoint.x * scale + offsetX,
      firstPoint.y * scale + offsetY - 5,
      color,
      scale
    );
  }

  ctx.restore();
}

// 绘制标签文字
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string | undefined,
  x: number,
  y: number,
  color: string,
  scale: number = 1
) {
  // 如果没有label，不绘制
  if (!text || text.trim() === '') return;
  
  ctx.save();
  
  const fontSize = Math.max(9, 9 / scale);
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  
  const metrics = ctx.measureText(text);
  const padding = 3;
  const height = fontSize + padding * 2;

  // 背景
  ctx.fillStyle = color;
  ctx.fillRect(x, y - height, metrics.width + padding * 2, height);

  // 文字
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x + padding, y - padding);

  ctx.restore();
}

// hex转rgb
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// 绘制所有标注
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  scale: number = 1,
  offsetX: number = 0,
  offsetY: number = 0,
  hiddenIds: Set<string> = new Set()
) {
  for (const annotation of annotations) {
    if (hiddenIds.has(annotation.id)) continue;

    switch (annotation.type) {
      case AnnotationType.BBOX:
        drawBBox(ctx, annotation as BBoxAnnotation, scale, offsetX, offsetY);
        break;
      case AnnotationType.POLYGON:
        drawPolygon(ctx, annotation as PolygonAnnotation, scale, offsetX, offsetY);
        break;
      case AnnotationType.POLYLINE:
        drawPolyline(ctx, annotation as PolylineAnnotation, scale, offsetX, offsetY);
        break;
      case AnnotationType.POINT:
        drawPoint(ctx, annotation as PointAnnotation, scale, offsetX, offsetY);
        break;
      case AnnotationType.SEGMENTATION:
        drawSegmentation(ctx, annotation as SegmentationAnnotation, scale, offsetX, offsetY);
        break;
    }
  }
}
