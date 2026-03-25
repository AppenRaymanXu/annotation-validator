# Annotation Validator - 标注校验工具

一个用于校验2D标注结果的可视化工具，支持多种标注类型。

## 功能特性

### 当前支持 (v1.0)
- **2D图像标注校验**
  - 矩形框 (BBox)
  - 多边形 (Polygon)
  - 折线 (Polyline)
  - 点 (Point)
  - 语义分割 (Segmentation)

### 即将推出
- 3D 点云标注校验
- 视频标注校验
- 音频标注校验
- 文本标注校验

## 快速开始

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 生产构建

```bash
npm run build
npm run preview
```

## Docker 部署

### 使用 Docker Compose (推荐)

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

访问 http://localhost:3000

### 使用 Docker 直接构建

```bash
# 构建镜像
docker build -t annotation-validator .

# 运行容器
docker run -d -p 3000:80 --name annotation-validator annotation-validator
```

## 标注格式说明

### 支持的输入方式

1. **文件上传** - 拖放或点击上传图片/JSON文件
2. **JSON编辑器** - 直接在编辑器中编写标注数据
3. **格式模板** - 使用预定义模板快速开始

### 标注数据格式

#### 矩形框标注
```json
{
  "shapes": [
    {
      "label": "car",
      "shape_type": "rectangle",
      "points": [[x1, y1], [x2, y2]]
    }
  ]
}
```

#### 多边形标注
```json
{
  "shapes": [
    {
      "label": "building",
      "shape_type": "polygon",
      "points": [[x1, y1], [x2, y2], [x3, y3], ...]
    }
  ]
}
```

#### 折线标注
```json
{
  "shapes": [
    {
      "label": "lane",
      "shape_type": "line",
      "points": [[x1, y1], [x2, y2], ...]
    }
  ]
}
```

#### 点标注
```json
{
  "shapes": [
    {
      "label": "keypoint",
      "shape_type": "point",
      "points": [[x, y]]
    }
  ]
}
```

#### 语义分割
```json
{
  "shapes": [
    {
      "label": "road",
      "shape_type": "polygon",
      "points": [[x1, y1], ...]
    }
  ]
}
```

### 兼容格式

工具兼容 LabelMe 导出的 JSON 格式。

## 操作说明

| 操作 | 方式 |
|------|------|
| 缩放 | 鼠标滚轮 / 右下角控制按钮 |
| 平移 | 鼠标左键拖拽 |
| 显示/隐藏标注 | 右侧面板勾选控制 |
| 适应窗口 | 点击右下角适应按钮 |

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Canvas API

## 项目结构

```
check/
├── src/
│   ├── components/      # React 组件
│   │   ├── ui/          # UI 基础组件
│   │   ├── Canvas.tsx   # 画布组件
│   │   ├── JsonEditor.tsx
│   │   ├── FormatGuide.tsx
│   │   └── ...
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   └── App.tsx
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## License

MIT
