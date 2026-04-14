import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FormatTemplate {
  title: string;
  description: string;
  format: string;
  example: string;
}

// 2D 标注模板
const templates2D: Record<string, FormatTemplate> = {
  bbox: {
    title: '矩形框标注',
    description: '用于目标检测任务，标注物体的边界框',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "rectangle",
      "points": [[x1, y1], [x2, y2]]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "car",
      "shape_type": "rectangle",
      "points": [[100, 100], [300, 250]]
    },
    {
      "label": "person",
      "shape_type": "rectangle",
      "points": [[350, 80], [450, 300]]
    }
  ]
}`,
  },
  polygon: {
    title: '多边形标注',
    description: '用于实例分割或精确轮廓标注',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "polygon",
      "points": [[x1, y1], [x2, y2], ...]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "building",
      "shape_type": "polygon",
      "points": [[100, 100], [200, 80], [250, 150], [220, 220], [120, 200]]
    }
  ]
}`,
  },
  polyline: {
    title: '折线标注',
    description: '用于车道线、边界线等线状目标',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "line",
      "points": [[x1, y1], [x2, y2], ...]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "lane",
      "shape_type": "line",
      "points": [[0, 400], [200, 350], [400, 320], [600, 300]]
    }
  ]
}`,
  },
  point: {
    title: '点标注',
    description: '用于关键点检测、地标标注等',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "point",
      "points": [[x, y]]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "left_eye",
      "shape_type": "point",
      "points": [[120, 150]]
    },
    {
      "label": "right_eye",
      "shape_type": "point",
      "points": [[180, 148]]
    }
  ]
}`,
  },
  segmentation: {
    title: '语义分割',
    description: '用于像素级分割，points为像素点坐标列表',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "segmentation",
      "points": [[x1,y1], [x2,y2], ...]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "road",
      "shape_type": "segmentation",
      "points": [[100, 200], [101, 200], [102, 200], [100, 201], [101, 201]]
    },
    {
      "label": "sky",
      "shape_type": "segmentation", 
      "points": [[50, 10], [51, 10], [52, 10], [50, 11], [51, 11]]
    }
  ]
}`,
  },
  labelme: {
    title: 'LabelMe 格式',
    description: '兼容 LabelMe 标注工具导出的JSON格式',
    format: `{
  "version": "5.0.1",
  "flags": {},
  "shapes": [...],
  "imagePath": "图片路径",
  "imageData": null,
  "imageHeight": 1080,
  "imageWidth": 1920
}`,
    example: `{
  "version": "5.0.1",
  "flags": {},
  "shapes": [
    {
      "label": "cat",
      "points": [[100, 100], [200, 200]],
      "group_id": null,
      "shape_type": "rectangle",
      "flags": {}
    }
  ],
  "imagePath": "sample.jpg",
  "imageData": null,
  "imageHeight": 480,
  "imageWidth": 640
}`,
  },
};

// 3D 点云标注模板
const templates3D: Record<string, FormatTemplate> = {
  bbox3d: {
    title: '3D 边界框',
    description: '用于点云 3D 目标检测，标注中心点、尺寸和旋转角度',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "bbox_3d",
      "center": [x, y, z],
      "size": [length, width, height],
      "rotation": [roll, pitch, yaw]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "car",
      "shape_type": "bbox_3d",
      "center": [10.5, 1.5, 20.3],
      "size": [4.5, 1.8, 1.5],
      "rotation": [0, 0, 0.785]
    },
    {
      "label": "pedestrian",
      "shape_type": "bbox_3d",
      "center": [5.2, 0.9, 15.8],
      "size": [0.6, 0.6, 1.7],
      "rotation": [0, 0, -0.5]
    }
  ]
}`,
  },
  polygon3d: {
    title: '3D 多边形',
    description: '用于点云中的 3D 多边形标注',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "polygon_3d",
      "points": [[x1, y1, z1], [x2, y2, z2], ...]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "road_surface",
      "shape_type": "polygon_3d",
      "points": [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 20],
        [0, 0, 20]
      ]
    }
  ]
}`,
  },
  polyline3d: {
    title: '3D 折线/车道线',
    description: '用于点云中的 3D 车道线、边界线等',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "polyline_3d",
      "points": [[x1, y1, z1], [x2, y2, z2], ...]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "lane_line",
      "shape_type": "polyline_3d",
      "points": [
        [0, 0.1, 0],
        [5, 0.1, 10],
        [10, 0.1, 20],
        [15, 0.1, 30]
      ]
    }
  ]
}`,
  },
  point3d: {
    title: '3D 点',
    description: '用于点云中的 3D 关键点标注',
    format: `{
  "shapes": [
    {
      "label": "标签名称",
      "shape_type": "point_3d",
      "points": [[x, y, z]]
    }
  ]
}`,
    example: `{
  "shapes": [
    {
      "label": "traffic_light",
      "shape_type": "point_3d",
      "points": [[12.5, 3.2, 25.8]]
    },
    {
      "label": "sign_post",
      "shape_type": "point_3d",
      "points": [[8.3, 2.1, 18.5]]
    }
  ]
}`,
  },
};

interface FormatGuideProps {
  onSelectTemplate: (template: string) => void;
  className?: string;
  dataType?: 'image2d' | 'pointcloud' | 'video' | 'audio' | 'text';
}

export function FormatGuide({ onSelectTemplate, className, dataType = 'image2d' }: FormatGuideProps) {
  const [selectedType, setSelectedType] = useState<string>(dataType === 'pointcloud' ? 'bbox3d' : 'bbox');
  const [showExample, setShowExample] = useState(true);

  // 根据数据类型选择模板
  const templates = dataType === 'pointcloud' ? templates3D : templates2D;
  const current = templates[selectedType] || Object.values(templates)[0];

  // 数据类型变化时重置选择
  useEffect(() => {
    setSelectedType(dataType === 'pointcloud' ? 'bbox3d' : 'bbox');
  }, [dataType]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">
          格式说明 - {dataType === 'pointcloud' ? '3D 点云' : '2D 图像'}
        </span>
        <Badge variant="secondary" className="text-xs">模板</Badge>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 类型列表 */}
        <div className="w-40 flex-shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="p-1">
              {Object.entries(templates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    selectedType === key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {template.title}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* 详情 */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <div>
                <h4 className="text-sm font-medium">{current.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{current.description}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">格式定义</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectTemplate(current.example)}
                    className="h-6 text-xs"
                  >
                    使用此模板
                  </Button>
                </div>
                <pre className="bg-muted/50 rounded-md p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {current.format}
                </pre>
              </div>

              {showExample && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">示例</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExample(false)}
                      className="h-6 text-xs"
                    >
                      收起
                    </Button>
                  </div>
                  <pre className="bg-muted/50 rounded-md p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {current.example}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
