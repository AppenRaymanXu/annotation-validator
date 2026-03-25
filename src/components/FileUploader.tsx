import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onImageSelect: (file: File) => void;
  onJsonSelect: (file: File) => void;
  className?: string;
}

export function FileUploader({ onImageSelect, onJsonSelect, className }: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'].includes(ext || '')) {
          onImageSelect(file);
        } else if (ext === 'json') {
          onJsonSelect(file);
        }
      });
    },
    [onImageSelect, onJsonSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'],
      'application/json': ['.json'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-8 transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
        isDragActive && "border-primary bg-primary/5",
        className
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-6 w-6 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isDragActive ? '松开以上传文件' : '拖放图片或标注文件到此处'}
          </p>
          <p className="text-xs text-muted-foreground">
            支持图片格式: JPG, PNG, BMP, GIF, WebP | 标注格式: JSON
          </p>
        </div>
      </div>
    </div>
  );
}
