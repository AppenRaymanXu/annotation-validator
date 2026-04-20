import { useState, useCallback, useRef } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Canvas } from '@/components/Canvas';
import { PointCloudCanvas } from '@/components/PointCloudCanvas';
import { JsonEditor } from '@/components/JsonEditor';
import { FormatGuide } from '@/components/FormatGuide';
import { Sidebar, DataType } from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import {
  Annotation,
  AnnotationType,
  AnnotationData,
  BBoxAnnotation,
  PolygonAnnotation,
  PolylineAnnotation,
  PointAnnotation,
  SegmentationAnnotation,
  BBox3DAnnotation,
  Polygon3DAnnotation,
  Polyline3DAnnotation,
  Point3DAnnotation,
} from '@/types/annotation';

// 默认空标注模板 - 2D
const DEFAULT_ANNOTATION_TEMPLATE_2D = `{
  "shapes": [
    {
      "label": "example",
      "shape_type": "rectangle",
      "points": [[100, 100], [200, 200]]
    }
  ]
}`;

// 默认空标注模板 - 3D
const DEFAULT_ANNOTATION_TEMPLATE_3D = `{
  "shapes": [
    {
      "label": "car",
      "shape_type": "bbox_3d",
      "center": [10.5, 1.5, 20.3],
      "size": [4.5, 1.8, 1.5],
      "rotation": [0, 0, 0.785]
    }
  ]
}`;

type BottomTab = 'editor' | 'guide';

function App() {
  // 数据类型状态
  const [dataType, setDataType] = useState<DataType>('image2d');
  
  // 图片和标注状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pointCloudUrl, setPointCloudUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  
  // 变换矩阵状态
  const [transformMatrix, setTransformMatrix] = useState<number[] | null>(null);
  
  // 输入相关状态
  const [bottomTab, setBottomTab] = useState<BottomTab>('editor');
  const [jsonValue, setJsonValue] = useState(DEFAULT_ANNOTATION_TEMPLATE_2D);
  
  // 面板显示状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);

  // 点云文件名（替代 window 全局变量）
  const pointCloudFileNameRef = useRef<string>('');

  // Toast 提示状态
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, duration = 3000) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), duration);
  }, []);

  // 切换数据类型
  const handleDataTypeChange = (type: DataType) => {
    setDataType(type);
    // 根据数据类型设置默认的 JSON 模板
    if (type === 'pointcloud') {
      setJsonValue(DEFAULT_ANNOTATION_TEMPLATE_3D);
    } else {
      setJsonValue(DEFAULT_ANNOTATION_TEMPLATE_2D);
    }
  };

  // 生成唯一ID
  const generateId = () => {
    return Math.random().toString(36).substring(2, 11);
  };

  // 解析标注数据
  const parseAnnotationData = useCallback((data: AnnotationData): Annotation[] => {
    // 基本结构校验
    if (!data.shapes || !Array.isArray(data.shapes)) {
      throw new Error('标注数据缺少 shapes 数组');
    }

    const results: Annotation[] = [];

    for (const shape of data.shapes) {
      if (!shape.shape_type) {
        console.warn('跳过缺少 shape_type 的标注项:', shape);
        continue;
      }

      const baseId = generateId();
      const label = shape.label || '';

      try {
        switch (shape.shape_type) {
          case 'rectangle': {
            if (!shape.points || shape.points.length < 2) {
              console.warn('Rectangle 缺少 points，跳过');
              continue;
            }
            const [p1, p2] = shape.points;
            results.push({
              id: baseId,
              type: AnnotationType.BBOX,
              label,
              bbox: [p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1]],
            } as BBoxAnnotation);
            break;
          }
          case 'polygon': {
            if (!shape.points || shape.points.length < 3) {
              console.warn('Polygon 缺少足够的 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POLYGON,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
            } as PolygonAnnotation);
            break;
          }
          case 'line': {
            if (!shape.points || shape.points.length < 2) {
              console.warn('Line 缺少足够的 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POLYLINE,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
            } as PolylineAnnotation);
            break;
          }
          case 'point': {
            if (!shape.points || shape.points.length === 0) {
              console.warn('Point 缺少 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POINT,
              label,
              point: { x: shape.points[0][0], y: shape.points[0][1] },
            } as PointAnnotation);
            break;
          }
          case 'segmentation': {
            if (!shape.points || shape.points.length === 0) {
              console.warn('Segmentation 缺少 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.SEGMENTATION,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
            } as SegmentationAnnotation);
            break;
          }
          // 3D 标注类型
          case 'bbox_3d': {
            let center, dimensions, rotation;
            
            if (shape.center && shape.size && shape.rotation) {
              if (shape.center.length < 3 || shape.size.length < 3 || shape.rotation.length < 3) {
                console.warn('BBox 3D 字段长度不足，跳过');
                continue;
              }
              center = { x: shape.center[0], y: shape.center[1], z: shape.center[2] };
              dimensions = [shape.size[0], shape.size[1], shape.size[2]];
              rotation = shape.rotation as [number, number, number];
            } else if (shape.dimensions && shape.rotation) {
              if (!shape.points || shape.points.length === 0 || shape.points[0].length < 3) {
                console.warn('BBox 3D (dimensions格式) 缺少有效的 center points，跳过');
                continue;
              }
              center = { x: shape.points[0][0], y: shape.points[0][1], z: shape.points[0][2] };
              dimensions = shape.dimensions as [number, number, number];
              rotation = shape.rotation as [number, number, number];
            } else {
              if (!shape.points || shape.points.length < 3) {
                console.warn('BBox 3D (旧格式) 缺少足够的 points，跳过');
                continue;
              }
              center = { x: shape.points[0][0], y: shape.points[0][1], z: shape.points[0][2] };
              dimensions = [shape.points[1][0], shape.points[1][1], shape.points[1][2]];
              rotation = shape.points[2] as [number, number, number];
            }
            
            results.push({
              id: baseId,
              type: AnnotationType.BBOX_3D,
              label,
              center,
              dimensions: dimensions as [number, number, number],
              rotation: rotation as [number, number, number],
              rotationType: 'euler',
            } as BBox3DAnnotation);
            break;
          }
          case 'polygon_3d': {
            if (!shape.points || shape.points.length < 3) {
              console.warn('Polygon 3D 缺少足够的 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POLYGON_3D,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1], z: p[2] || 0 })),
            } as Polygon3DAnnotation);
            break;
          }
          case 'polyline_3d': {
            if (!shape.points || shape.points.length < 2) {
              console.warn('Polyline 3D 缺少足够的 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POLYLINE_3D,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1], z: p[2] || 0 })),
            } as Polyline3DAnnotation);
            break;
          }
          case 'point_3d': {
            if (!shape.points || shape.points.length === 0 || shape.points[0].length < 3) {
              console.warn('Point 3D 缺少有效的 points，跳过');
              continue;
            }
            results.push({
              id: baseId,
              type: AnnotationType.POINT_3D,
              label,
              point: { x: shape.points[0][0], y: shape.points[0][1], z: shape.points[0][2] },
            } as Point3DAnnotation);
            break;
          }
          default:
            console.warn(`未知标注类型 "${shape.shape_type}"，跳过`);
            break;
        }
      } catch (e) {
        console.warn(`解析标注 "${label}" (${shape.shape_type}) 失败:`, e);
      }
    }

    return results;
  }, []);

  // 解析JSON字符串为标注
  const parseJsonString = useCallback(
    (jsonStr: string): boolean => {
      try {
        const data = JSON.parse(jsonStr);

        let annotationData: AnnotationData;
        if (data.shapes && Array.isArray(data.shapes)) {
          annotationData = {
            imageWidth: data.imageWidth,
            imageHeight: data.imageHeight,
            shapes: data.shapes.map((s: Record<string, unknown>) => ({
              label: s.label as string,
              points: s.points as number[][],
              center: s.center as number[],
              size: s.size as number[],
              dimensions: s.dimensions as number[],
              rotation: s.rotation as number[],
              shape_type: (s.shape_type as string) || 'polygon',
              group_id: s.group_id as string | null,
              description: s.description as string,
            })),
          };
        } else if (Array.isArray(data)) {
          annotationData = {
            shapes: data.map((item: Record<string, unknown>) => ({
              label: (item.label as string) || '',
              points: (item.points as number[][]) || (item.coordinates as number[][]) || [],
              center: item.center as number[],
              size: item.size as number[],
              dimensions: item.dimensions as number[],
              rotation: item.rotation as number[],
              shape_type: (item.type as string) || (item.shape_type as string) || 'polygon',
              group_id: null,
              description: '',
            })),
          };
        } else {
          console.error('Unknown annotation format');
          return false;
        }

        const parsed = parseAnnotationData(annotationData);
        setAnnotations(parsed);
        // 使用 useMemo 优化 hiddenIds，避免每次渲染创建新 Set
        setHiddenIds(new Set());
        return true;
      } catch (error) {
        console.error('Failed to parse annotation:', error);
        return false;
      }
    },
    [parseAnnotationData]
  );

  // 处理图片文件
  const handleImageFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return url;
    });
  }, []);

  // 处理点云文件
  const handlePointCloudFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPointCloudUrl((prevUrl) => {
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      return url;
    });
    // 保存文件名到 ref（替代 window 全局变量）
    pointCloudFileNameRef.current = file.name;
  }, []);

  // 应用JSON编辑器内容
  const handleApplyJson = () => {
    if (parseJsonString(jsonValue)) {
      // 成功
    } else {
      showToast('标注数据解析失败，请检查格式');
    }
  };

  // 选择模板
  const handleSelectTemplate = (template: string) => {
    setJsonValue(template);
    setBottomTab('editor');
  };

  // 应用变换矩阵
  const handleApplyTransform = (values: number[]) => {
    setTransformMatrix(values);
  };

  // 重置变换矩阵
  const handleResetTransform = () => {
    setTransformMatrix(null);
  };

  return (
    <ErrorBoundary>
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧边栏 */}
      <Sidebar
        activeType={dataType}
        onTypeChange={handleDataTypeChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="flex-shrink-0"
      />

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 上方画布区域 */}
        <div className="relative flex-1 overflow-hidden">
          {dataType === 'image2d' ? (
            <Canvas
              imageUrl={imageUrl}
              annotations={annotations}
              hiddenIds={hiddenIds}
              onImageDrop={handleImageFile}
              className="h-full w-full"
            />
          ) : dataType === 'pointcloud' ? (
            <PointCloudCanvas
              pointCloudUrl={pointCloudUrl}
              annotations={annotations}
              hiddenIds={hiddenIds}
              onPointCloudDrop={handlePointCloudFile}
              transformMatrix={transformMatrix}
              onTransformApply={handleApplyTransform}
              onTransformReset={handleResetTransform}
              pointCloudFileName={pointCloudFileNameRef.current}
              className="h-full w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg">该数据类型暂未实现</p>
                <p className="text-sm mt-2">敬请期待...</p>
              </div>
            </div>
          )}
        </div>

        {/* 下方标注输入面板 */}
        <div
          className={cn(
            "flex flex-col bg-card border-t transition-all duration-200",
            bottomPanelCollapsed ? "h-12" : "h-72"
          )}
        >
          {/* 面板头部 */}
          <div className="flex items-center justify-between border-b px-3 h-12 flex-shrink-0">
            <div className="flex items-center gap-1">
              {bottomPanelCollapsed ? (
                <button
                  onClick={() => setBottomPanelCollapsed(false)}
                  className="p-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
                  title="展开面板"
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span className="text-sm">标注输入</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setBottomTab('editor')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
                      bottomTab === 'editor'
                        ? "border-primary text-primary font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => setBottomTab('guide')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
                      bottomTab === 'guide'
                        ? "border-primary text-primary font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>格式</span>
                  </button>
                </>
              )}
            </div>
            
            {!bottomPanelCollapsed && (
              <button
                onClick={() => setBottomPanelCollapsed(true)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="收起面板"
              >
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* 面板内容 */}
          {!bottomPanelCollapsed && (
            <div className="flex-1 overflow-hidden">
              {bottomTab === 'editor' && (
                <JsonEditor
                  value={jsonValue}
                  onChange={setJsonValue}
                  onApply={handleApplyJson}
                  className="h-full"
                />
              )}
              {bottomTab === 'guide' && (
                <FormatGuide
                  onSelectTemplate={handleSelectTemplate}
                  dataType={dataType}
                  className="h-full"
                />
              )}
            </div>
          )}
        </div>
      </div>
      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;
