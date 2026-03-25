import { cn } from '@/lib/utils';

export type DataType = 'image2d' | 'pointcloud' | 'video' | 'audio' | 'text';

interface DataTypeConfig {
  id: DataType;
  label: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

const dataTypes: DataTypeConfig[] = [
  {
    id: 'image2d',
    label: '2D 图像',
    description: '图像标注校验',
    available: true,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: 'pointcloud',
    label: '3D 点云',
    description: '点云标注校验',
    available: false,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
  {
    id: 'video',
    label: '视频',
    description: '视频标注校验',
    available: false,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: 'audio',
    label: '音频',
    description: '音频标注校验',
    available: false,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  },
  {
    id: 'text',
    label: '文本',
    description: '文本标注校验',
    available: false,
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  activeType: DataType;
  onTypeChange: (type: DataType) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function Sidebar({
  activeType,
  onTypeChange,
  collapsed = false,
  onToggleCollapse,
  className
}: SidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-card border-r transition-all duration-200",
        collapsed ? "w-14" : "w-56",
        className
      )}
    >
      {/* Logo / Toggle */}
      <div
        className={cn(
          "flex items-center border-b transition-colors",
          collapsed ? "justify-center py-3" : "gap-2 px-4 py-4"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-primary flex-shrink-0",
            collapsed && "cursor-pointer hover:bg-primary/80"
          )}
          onClick={collapsed ? onToggleCollapse : undefined}
          title={collapsed ? "展开侧边栏" : undefined}
        >
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        {!collapsed && (
          <>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-semibold">标注校验</span>
              <span className="text-[10px] text-muted-foreground">Annotation Validator</span>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="收起侧边栏"
            >
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 py-2">
        {!collapsed && (
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">数据类型</span>
          </div>
        )}
        <nav className={cn("space-y-1", collapsed ? "px-1" : "px-2")}>
          {dataTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => type.available && onTypeChange(type.id)}
              disabled={!type.available}
              title={collapsed ? type.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-left transition-colors",
                collapsed
                  ? "w-full justify-center px-0 py-2.5"
                  : "w-full gap-3 px-3 py-2.5",
                type.available
                  ? activeType === type.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                  : "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="flex-shrink-0">{type.icon}</span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{type.label}</span>
                    {!type.available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        即将推出
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs",
                    activeType === type.id ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {type.description}
                  </span>
                </div>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 底部信息 */}
      <div className={cn("border-t", collapsed ? "p-1" : "p-3")}>
        {!collapsed && (
          <div className="text-[10px] text-muted-foreground text-center">
            v1.0.0 · 多模态标注
          </div>
        )}
      </div>
    </div>
  );
}
