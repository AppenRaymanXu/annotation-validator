// 标注类型枚举
export enum AnnotationType {
  BBOX = 'bbox',           // 矩形框
  POLYGON = 'polygon',     // 多边形
  POLYLINE = 'polyline',   // 折线
  POINT = 'point',         // 点
  SEGMENTATION = 'segmentation', // 语义分割
}

// 坐标点
export interface Point {
  x: number;
  y: number;
}

// 矩形框标注
export interface BBoxAnnotation {
  id: string;
  type: AnnotationType.BBOX;
  label: string;
  bbox: [number, number, number, number]; // [x, y, width, height]
  color?: string;
}

// 多边形标注
export interface PolygonAnnotation {
  id: string;
  type: AnnotationType.POLYGON;
  label: string;
  points: Point[];
  color?: string;
}

// 折线标注
export interface PolylineAnnotation {
  id: string;
  type: AnnotationType.POLYLINE;
  label: string;
  points: Point[];
  color?: string;
}

// 点标注
export interface PointAnnotation {
  id: string;
  type: AnnotationType.POINT;
  label: string;
  point: Point;
  color?: string;
}

// 语义分割标注 (像素点列表)
export interface SegmentationAnnotation {
  id: string;
  type: AnnotationType.SEGMENTATION;
  label: string;
  points: Point[]; // 像素点坐标数组
  color?: string;
  alpha?: number; // 透明度
}

// 联合类型
export type Annotation = 
  | BBoxAnnotation 
  | PolygonAnnotation 
  | PolylineAnnotation 
  | PointAnnotation 
  | SegmentationAnnotation;

// 标注文件格式
export interface AnnotationFile {
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
}

// 标注数据（用于导入）
export interface AnnotationData {
  imageWidth?: number;
  imageHeight?: number;
  shapes: Array<{
    label: string;
    points: number[][];
    shape_type: string;
    group_id?: string | null;
    description?: string;
  }>;
}

// 图片信息
export interface ImageInfo {
  url: string;
  width: number;
  height: number;
  name: string;
}

// 视图状态
export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// 预定义颜色
export const ANNOTATION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#14b8a6', // teal
];

// 获取标签颜色
export function getLabelColor(label: string, _index: number): string {
  // 根据标签名生成稳定的颜色
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % ANNOTATION_COLORS.length;
  return ANNOTATION_COLORS[colorIndex];
}
