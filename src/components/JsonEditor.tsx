import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  className?: string;
}

export function JsonEditor({ value, onChange, onApply, className }: JsonEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);

    // 实时验证JSON
    if (newValue.trim()) {
      try {
        JSON.parse(newValue);
        setError(null);
      } catch {
        setError('JSON 格式错误');
      }
    } else {
      setError(null);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(localValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setLocalValue(formatted);
      onChange(formatted);
      setError(null);
    } catch {
      setError('无法格式化：JSON 格式错误');
    }
  };

  const handleApply = () => {
    if (!error) {
      onApply();
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">JSON 编辑器</span>
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-7 text-xs"
          >
            格式化
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            disabled={!!error || !localValue.trim()}
            className="h-7 text-xs"
          >
            应用
          </Button>
        </div>
      </div>

      {/* 编辑器 */}
      <textarea
        value={localValue}
        onChange={handleChange}
        className="flex-1 resize-none bg-muted/30 p-3 font-mono text-xs leading-relaxed focus:outline-none"
        placeholder="在此输入标注数据..."
        spellCheck={false}
      />
    </div>
  );
}
