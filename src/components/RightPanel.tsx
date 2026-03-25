import { cn } from '@/lib/utils';
import { TabType } from './InputTabs';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: 'upload',
    label: '上传',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    ),
  },
  {
    id: 'editor',
    label: 'JSON',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
  {
    id: 'guide',
    label: '格式',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
];

interface RightPanelProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
  className?: string;
}

export function RightPanel({
  collapsed = false,
  onToggleCollapse,
  activeTab,
  onTabChange,
  children,
  className
}: RightPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-card border-l transition-all duration-200",
        collapsed ? "w-14" : "w-80",
        className
      )}
    >
      {/* Header with toggle */}
      <div
        className={cn(
          "flex items-center border-b transition-colors",
          collapsed ? "justify-center py-3" : "gap-2 px-4 py-3"
        )}
      >
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="展开面板"
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <>
            <span className="text-sm font-medium flex-1">标注输入</span>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="收起面板"
            >
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {collapsed ? (
        // 收缩状态：只显示图标按钮
        <div className="flex flex-col items-center py-2 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                onToggleCollapse?.();
              }}
              title={tab.label}
              className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      ) : (
        // 展开状态：显示标签页和内容
        <>
          {/* Tabs */}
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
