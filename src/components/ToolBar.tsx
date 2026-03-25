import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolBarProps {
  imageUrl: string | null;
  annotationsCount: number;
  onLoadImage: () => void;
  onLoadJson: () => void;
  onClear: () => void;
  className?: string;
}

export function ToolBar({
  imageUrl,
  annotationsCount,
  onLoadImage,
  onLoadJson,
  onClear,
  className,
}: ToolBarProps) {
  return (
    <div className={cn("flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur-sm", className)}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg
            className="h-4 w-4 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <span className="font-semibold">标注校验</span>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* 操作按钮 */}
      <Button variant="outline" size="sm" onClick={onLoadImage}>
        <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        加载图片
      </Button>

      <Button variant="outline" size="sm" onClick={onLoadJson}>
        <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        加载标注
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* 状态 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {imageUrl && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success" />
            图片已加载
          </span>
        )}
        {annotationsCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {annotationsCount} 个标注
          </span>
        )}
      </div>

      {/* 清空按钮 */}
      {(imageUrl || annotationsCount > 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          清空
        </Button>
      )}
    </div>
  );
}
