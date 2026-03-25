import { useState, useCallback } from 'react';
import { Canvas } from '@/components/Canvas';
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
} from '@/types/annotation';

// 默认空标注模板
const DEFAULT_ANNOTATION_TEMPLATE = `{
  "shapes": [
    {
      "label": "example",
      "shape_type": "rectangle",
      "points": [[100, 100], [200, 200]]
    }
  ]
}`;

type BottomTab = 'editor' | 'guide';

function App() {
  // 数据类型状态
  const [dataType, setDataType] = useState<DataType>('image2d');
  
  // 图片和标注状态
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  
  // 输入相关状态
  const [bottomTab, setBottomTab] = useState<BottomTab>('editor');
  const [jsonValue, setJsonValue] = useState(DEFAULT_ANNOTATION_TEMPLATE);
  
  // 面板显示状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);

  // 生成唯一ID
  const generateId = () => {
    return Math.random().toString(36).substring(2, 11);
  };

  // 解析标注数据
  const parseAnnotationData = useCallback((data: AnnotationData): Annotation[] => {
    return data.shapes.map((shape): Annotation => {
      const baseId = generateId();
      const label = shape.label || '';

      switch (shape.shape_type) {
        case 'rectangle': {
          const [p1, p2] = shape.points;
          const bbox: BBoxAnnotation = {
            id: baseId,
            type: AnnotationType.BBOX,
            label,
            bbox: [p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1]],
          };
          return bbox;
        }
        case 'polygon': {
          const polygon: PolygonAnnotation = {
            id: baseId,
            type: AnnotationType.POLYGON,
            label,
            points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
          };
          return polygon;
        }
        case 'line': {
          const polyline: PolylineAnnotation = {
            id: baseId,
            type: AnnotationType.POLYLINE,
            label,
            points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
          };
          return polyline;
        }
        case 'point': {
          const point: PointAnnotation = {
            id: baseId,
            type: AnnotationType.POINT,
            label,
            point: { x: shape.points[0][0], y: shape.points[0][1] },
          };
          return point;
        }
        case 'segmentation': {
          const seg: SegmentationAnnotation = {
            id: baseId,
            type: AnnotationType.SEGMENTATION,
            label,
            points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
          };
          return seg;
        }
        default:
          if (shape.points.length === 1) {
            const pt: PointAnnotation = {
              id: baseId,
              type: AnnotationType.POINT,
              label,
              point: { x: shape.points[0][0], y: shape.points[0][1] },
            };
            return pt;
          } else if (shape.points.length === 2) {
            const [pt1, pt2] = shape.points;
            const box: BBoxAnnotation = {
              id: baseId,
              type: AnnotationType.BBOX,
              label,
              bbox: [pt1[0], pt1[1], pt2[0] - pt1[0], pt2[1] - pt1[1]],
            };
            return box;
          } else {
            const poly: PolygonAnnotation = {
              id: baseId,
              type: AnnotationType.POLYGON,
              label,
              points: shape.points.map((p) => ({ x: p[0], y: p[1] })),
            };
            return poly;
          }
      }
    });
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

  // 应用JSON编辑器内容
  const handleApplyJson = () => {
    if (parseJsonString(jsonValue)) {
      // 成功
    } else {
      alert('标注数据解析失败，请检查格式');
    }
  };

  // 选择模板
  const handleSelectTemplate = (template: string) => {
    setJsonValue(template);
    setBottomTab('editor');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧边栏 */}
      <Sidebar
        activeType={dataType}
        onTypeChange={setDataType}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="flex-shrink-0"
      />

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 上方画布区域 */}
        <div className="relative flex-1 overflow-hidden">
          <Canvas
            imageUrl={imageUrl}
            annotations={annotations}
            hiddenIds={hiddenIds}
            onImageDrop={handleImageFile}
            className="h-full w-full"
          />
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
                  className="h-full"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
