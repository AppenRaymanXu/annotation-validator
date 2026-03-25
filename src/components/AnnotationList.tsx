import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Annotation,
  AnnotationType,
  getLabelColor,
} from '@/types/annotation';

interface AnnotationListProps {
  annotations: Annotation[];
  hiddenIds: Set<string>;
  onToggleVisibility: (id: string) => void;
  onToggleAll: (visible: boolean) => void;
  className?: string;
}

const typeLabels: Record<AnnotationType, string> = {
  [AnnotationType.BBOX]: '矩形框',
  [AnnotationType.POLYGON]: '多边形',
  [AnnotationType.POLYLINE]: '折线',
  [AnnotationType.POINT]: '点',
  [AnnotationType.SEGMENTATION]: '分割',
};

const typeIcons: Record<AnnotationType, React.ReactNode> = {
  [AnnotationType.BBOX]: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
    </svg>
  ),
  [AnnotationType.POLYGON]: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" strokeWidth={2} />
    </svg>
  ),
  [AnnotationType.POLYLINE]: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M3 17l6-6 4 4 8-8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [AnnotationType.POINT]: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  ),
  [AnnotationType.SEGMENTATION]: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z" strokeWidth={2} />
    </svg>
  ),
};

export function AnnotationList({
  annotations,
  hiddenIds,
  onToggleVisibility,
  onToggleAll,
  className,
}: AnnotationListProps) {
  const allVisible = hiddenIds.size === 0;

  // 按类型分组
  const groupedAnnotations = annotations.reduce((acc, ann) => {
    if (!acc[ann.type]) {
      acc[ann.type] = [];
    }
    acc[ann.type].push(ann);
    return acc;
  }, {} as Record<AnnotationType, Annotation[]>);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allVisible}
            onCheckedChange={(checked) => onToggleAll(checked as boolean)}
          />
          <span className="text-sm font-medium">标注列表</span>
          <Badge variant="secondary" className="text-xs">
            {annotations.length}
          </Badge>
        </div>
      </div>

      {/* 列表 */}
      <ScrollArea className="flex-1">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <svg
              className="h-8 w-8 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="mt-2 text-xs">暂无标注数据</p>
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedAnnotations).map(([type, items]) => (
              <div key={type} className="mb-2">
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                  {typeIcons[type as AnnotationType]}
                  <span>{typeLabels[type as AnnotationType]}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {items.length}
                  </Badge>
                </div>
                {items.map((annotation) => {
                  const color = annotation.color || getLabelColor(annotation.label, 0);
                  const isHidden = hiddenIds.has(annotation.id);

                  return (
                    <div
                      key={annotation.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent",
                        isHidden && "opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={!isHidden}
                        onCheckedChange={() => onToggleVisibility(annotation.id)}
                        className="data-[state=checked]:bg-[var(--color)] data-[state=checked]:border-[var(--color)]"
                        style={{ '--color': color } as React.CSSProperties}
                      />
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="flex-1 truncate text-sm">{annotation.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
