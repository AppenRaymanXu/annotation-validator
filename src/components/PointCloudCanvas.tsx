import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { cn } from '@/lib/utils';
import { 
  Annotation, 
  AnnotationType,
  BBox3DAnnotation, 
  Polygon3DAnnotation, 
  Polyline3DAnnotation,
  Point3DAnnotation,
  getLabelColor 
} from '@/types/annotation';

interface PointCloudCanvasProps {
  pointCloudUrl: string | null;
  annotations: Annotation[];
  hiddenIds: Set<string>;
  onPointCloudDrop?: (file: File) => void;
  className?: string;
}

// 点云数据格式
interface PointCloudData {
  points: number[][]; // [[x, y, z], ...]
  colors?: number[][]; // [[r, g, b], ...] 可选
}

export function PointCloudCanvas({ 
  pointCloudUrl, 
  annotations, 
  hiddenIds, 
  onPointCloudDrop,
  className 
}: PointCloudCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const annotationGroupRef = useRef<THREE.Group | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [colorMode, setColorMode] = useState<'original' | 'intensity' | 'height'>('original');
  const [hasIntensity, setHasIntensity] = useState(false);
  const [hasColor, setHasColor] = useState(false);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // 相机 - 右手坐标系：X向前，Y向左，Z向上
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    // 设置相机位置：从右后上方观察
    camera.position.set(10, -10, 10);
    camera.up.set(0, 0, 1); // Z轴向上
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 控制器 - 右手坐标系
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 添加坐标轴辅助
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // 不添加网格辅助（去掉棋盘格）
    // const gridHelper = new THREE.GridHelper(100, 100);
    // scene.add(gridHelper);

    // 标注组
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    annotationGroupRef.current = annotationGroup;

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 响应式调整
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 应用颜色模式
  const applyColorMode = useCallback((mode: 'original' | 'intensity' | 'height') => {
    if (!pointCloudRef.current) return;
    
    const geometry = pointCloudRef.current.geometry;
    const attributes = geometry.attributes;
    const positionArray = attributes.position.array as Float32Array;
    
    // 移除旧的颜色属性
    if (attributes.color) {
      geometry.deleteAttribute('color');
    }
    
    if (mode === 'original' && attributes.color) {
      // 如果有原始颜色，重新添加
      // 这里需要保存原始颜色，简化处理：重新加载
      console.log('使用原始颜色');
    } else if (mode === 'intensity' && attributes.intensity) {
      // 使用 intensity 着色 - 提高对比度
      const intensityArray = attributes.intensity.array as Float32Array;
      const colors = new Float32Array(positionArray.length);
      
      let minIntensity = Infinity;
      let maxIntensity = -Infinity;
      for (let i = 0; i < intensityArray.length; i++) {
        minIntensity = Math.min(minIntensity, intensityArray[i]);
        maxIntensity = Math.max(maxIntensity, intensityArray[i]);
      }
      
      const range = maxIntensity - minIntensity || 1;
      for (let i = 0; i < intensityArray.length; i++) {
        // 归一化到 0-1
        let normalized = (intensityArray[i] - minIntensity) / range;
        // 应用 gamma 校正提高对比度 (gamma < 1 提高对比度)
        normalized = Math.pow(normalized, 0.6);
        colors[i * 3] = normalized;
        colors[i * 3 + 1] = normalized;
        colors[i * 3 + 2] = normalized;
      }
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    } else if (mode === 'height') {
      // 使用高度（Z 轴）着色 - 提高对比度
      const colors = new Float32Array(positionArray.length);
      
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < positionArray.length; i += 3) {
        minZ = Math.min(minZ, positionArray[i + 2]);
        maxZ = Math.max(maxZ, positionArray[i + 2]);
      }
      
      const range = maxZ - minZ || 1;
      for (let i = 0; i < positionArray.length; i += 3) {
        // 归一化到 0-1
        let normalized = (positionArray[i + 2] - minZ) / range;
        // 应用 gamma 校正提高对比度
        normalized = Math.pow(normalized, 0.7);
        // 使用更鲜明的渐变色（蓝-青-绿-黄-红）
        colors[i] = Math.pow(normalized, 0.8);         // R - 增强高值
        colors[i + 1] = 0.3 + normalized * 0.7;        // G - 中间值更亮
        colors[i + 2] = Math.pow(1 - normalized, 0.8); // B - 增强低值
      }
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // 更新材质
    const material = pointCloudRef.current.material as THREE.PointsMaterial;
    material.vertexColors = mode !== 'original' || hasColor;
    material.needsUpdate = true;
    
    // 更新颜色属性
    const colorAttribute = geometry.attributes.color;
    if (colorAttribute) {
      colorAttribute.needsUpdate = true;
    }
  }, [hasColor]);

  // 加载点云数据
  const loadPointCloud = useCallback(async (url: string) => {
    if (!sceneRef.current) return;

    setIsLoading(true);

    try {
      // 移除旧点云
      if (pointCloudRef.current) {
        sceneRef.current.remove(pointCloudRef.current);
        pointCloudRef.current.geometry.dispose();
        (pointCloudRef.current.material as THREE.Material).dispose();
        pointCloudRef.current = null;
      }

      // 获取文件名（从 window 对象或 URL）
      const fileName = (window as any).__pointCloudFileName || url;
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      
      console.log('加载点云文件:', { fileName, fileExt, url });
      
      let pointCloud: THREE.Points;

      if (fileExt === 'pcd') {
        // 使用 PCDLoader 加载 PCD 文件
        const loader = new PCDLoader();
        pointCloud = await new Promise<THREE.Points>((resolve, reject) => {
          loader.load(
            url,
            (points: THREE.Points) => {
              // 处理 PCD 点云的颜色和强度
              const geometry = points.geometry;
              const attributes = geometry.attributes;
              
              const hasColorAttr = !!attributes.color;
              const hasIntensityAttr = !!attributes.intensity;
              
              console.log('PCD 属性:', {
                hasColor: hasColorAttr,
                hasIntensity: hasIntensityAttr,
                hasNormal: !!attributes.normal,
                positionCount: attributes.position.count
              });
              
              setHasColor(hasColorAttr);
              setHasIntensity(hasIntensityAttr);
              
              // 如果有 intensity 但没有 color，默认使用 intensity 着色
              if (hasIntensityAttr && !hasColorAttr) {
                setColorMode('intensity');
              } else if (hasColorAttr) {
                setColorMode('original');
              } else {
                setColorMode('height');
              }
              
              resolve(points);
            },
            undefined,
            (error: unknown) => reject(error)
          );
        });
      } else if (fileExt === 'json') {
        // 加载 JSON 格式的点云数据
        const response = await fetch(url);
        const data: PointCloudData = await response.json();

        // 创建点云几何体
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(data.points.length * 3);
        const colors = new Float32Array(data.points.length * 3);

        data.points.forEach((point, i) => {
          positions[i * 3] = point[0];
          positions[i * 3 + 1] = point[1];
          positions[i * 3 + 2] = point[2];

          // 如果有颜色数据，使用它；否则使用默认颜色
          if (data.colors && data.colors[i]) {
            colors[i * 3] = data.colors[i][0] / 255;
            colors[i * 3 + 1] = data.colors[i][1] / 255;
            colors[i * 3 + 2] = data.colors[i][2] / 255;
          } else {
            // 默认根据高度着色
            const height = (point[1] + 10) / 20; // 假设 y 是高度
            colors[i * 3] = 0.5 + height * 0.5;
            colors[i * 3 + 1] = 0.5;
            colors[i * 3 + 2] = 0.8 - height * 0.3;
          }
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // 创建点云材质
        const material = new THREE.PointsMaterial({
          size: 0.1,
          vertexColors: true,
          sizeAttenuation: true,
        });

        pointCloud = new THREE.Points(geometry, material);
      } else {
        throw new Error(`不支持的文件格式: ${fileExt}`);
      }
      sceneRef.current.add(pointCloud);
      pointCloudRef.current = pointCloud;

      // 自动调整相机位置
      const boundingBox = new THREE.Box3().setFromObject(pointCloud);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      
      console.log('点云信息:', {
        center: { x: center.x, y: center.y, z: center.z },
        size: { x: size.x, y: size.y, z: size.z },
        pointsCount: pointCloud.geometry.attributes.position.count
      });
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current!.fov * (Math.PI / 180);
      let cameraZ = maxDim / (2 * Math.tan(fov / 2));
      cameraZ *= 2.0; // 增加距离以便更好地查看

      cameraRef.current!.position.set(center.x + cameraZ, center.y + cameraZ / 2, center.z + cameraZ);
      cameraRef.current!.lookAt(center);
      controlsRef.current!.target.copy(center);
      controlsRef.current!.update();

    } catch (error) {
      console.error('Failed to load point cloud:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`加载点云失败: ${errorMessage}\n\n请检查:\n1. 文件格式是否正确\n2. 文件是否损坏\n3. 浏览器控制台查看详细错误`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载点云文件
  useEffect(() => {
    if (pointCloudUrl) {
      console.log('开始加载点云:', pointCloudUrl);
      loadPointCloud(pointCloudUrl);
    }
  }, [pointCloudUrl, loadPointCloud]);

  // 绘制 3D 边界框
  const drawBBox3D = useCallback((annotation: BBox3DAnnotation) => {
    if (!annotationGroupRef.current) return;

    const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));
    const { center, dimensions, rotation } = annotation;
    const [length, width, height] = dimensions;

    // 创建边界框几何体
    const geometry = new THREE.BoxGeometry(length, height, width);
    
    // 创建线框材质
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 2,
    });
    
    const wireframe = new THREE.LineSegments(edges, material);
    
    // 设置位置
    wireframe.position.set(center.x, center.y, center.z);
    
    // 设置旋转
    const rotationType = annotation.rotationType || 'euler';
    if (rotationType === 'euler') {
      const [roll, pitch, yaw] = rotation as [number, number, number];
      wireframe.rotation.set(roll, pitch, yaw);
    } else {
      // 四元数旋转
      const quaternion = rotation as unknown as [number, number, number, number];
      wireframe.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
    }

    annotationGroupRef.current.add(wireframe);

    // 添加标签（使用 sprite）
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 256;
      canvas.height = 64;
      context.fillStyle = '#' + color.getHexString();
      context.fillRect(0, 0, 256, 64);
      context.fillStyle = '#ffffff';
      context.font = 'bold 32px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(annotation.label, 128, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(center.x, center.y + height / 2 + 1, center.z);
      sprite.scale.set(4, 1, 1);
      annotationGroupRef.current.add(sprite);
    }
  }, []);

  // 绘制 3D 多边形
  const drawPolygon3D = useCallback((annotation: Polygon3DAnnotation) => {
    if (!annotationGroupRef.current || annotation.points.length < 3) return;

    const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

    // 创建多边形几何体
    const shape = new THREE.Shape();
    const points = annotation.points;
    
    shape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ 
      color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // 设置 Y 坐标（使用平均高度）
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    mesh.position.y = avgY;
    mesh.rotation.x = -Math.PI / 2; // 旋转到 XZ 平面

    annotationGroupRef.current.add(mesh);

    // 添加边框
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.y = avgY;
    wireframe.rotation.x = -Math.PI / 2;
    annotationGroupRef.current.add(wireframe);
  }, []);

  // 绘制 3D 折线（车道线等）
  const drawPolyline3D = useCallback((annotation: Polyline3DAnnotation) => {
    if (!annotationGroupRef.current || annotation.points.length < 2) return;

    const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

    // 创建线条几何体
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(annotation.points.length * 3);

    annotation.points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 2,
    });

    const line = new THREE.Line(geometry, material);
    annotationGroupRef.current.add(line);

    // 绘制端点
    annotation.points.forEach((point) => {
      const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(point.x, point.y, point.z);
      if (annotationGroupRef.current) {
        annotationGroupRef.current.add(sphere);
      }
    });
  }, []);

  // 绘制 3D 点
  const drawPoint3D = useCallback((annotation: Point3DAnnotation) => {
    if (!annotationGroupRef.current) return;

    const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

    // 创建球体表示点
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(annotation.point.x, annotation.point.y, annotation.point.z);
    annotationGroupRef.current.add(sphere);
  }, []);

  // 更新标注
  useEffect(() => {
    if (!annotationGroupRef.current) return;

    // 清除旧标注
    while (annotationGroupRef.current.children.length > 0) {
      const child = annotationGroupRef.current.children[0];
      annotationGroupRef.current.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Sprite) {
        (child.material as THREE.SpriteMaterial).map?.dispose();
        (child.material as THREE.SpriteMaterial).dispose();
      }
    }

    // 绘制新标注
    annotations.forEach((annotation) => {
      if (hiddenIds.has(annotation.id)) return;

      switch (annotation.type) {
        case AnnotationType.BBOX_3D:
          drawBBox3D(annotation as BBox3DAnnotation);
          break;
        case AnnotationType.POLYGON_3D:
          drawPolygon3D(annotation as Polygon3DAnnotation);
          break;
        case AnnotationType.POLYLINE_3D:
          drawPolyline3D(annotation as Polyline3DAnnotation);
          break;
        case AnnotationType.POINT_3D:
          drawPoint3D(annotation as Point3DAnnotation);
          break;
      }
    });
  }, [annotations, hiddenIds, drawBBox3D, drawPolygon3D, drawPolyline3D, drawPoint3D]);

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const isOutside = 
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom;
      if (isOutside) {
        setIsDragOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && onPointCloudDrop) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['json', 'pcd', 'ply', 'las', 'laz'].includes(ext || '')) {
        onPointCloudDrop(file);
      }
    }
  }, [onPointCloudDrop]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden bg-[#1a1a1a]", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖放提示遮罩 */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm font-medium text-primary">松开以加载点云</p>
          </div>
        </div>
      )}

      {/* 加载提示 */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm">加载点云中...</p>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!pointCloudUrl && !isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <svg
              className="mx-auto h-16 w-16 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            <p className="mt-2 text-sm">拖放点云文件到此处</p>
            <p className="mt-1 text-xs text-gray-500">支持 JSON, PCD, PLY, LAS 格式</p>
          </div>
        </div>
      )}

      {/* 操作提示 */}
      {pointCloudUrl && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
          <p>🖱️ 左键旋转 | 右键平移 | 滚轮缩放</p>
          <p className="mt-1 text-gray-300">坐标系：X向前(红) Y向左(绿) Z向上(蓝)</p>
        </div>
      )}

      {/* 颜色模式切换 */}
      {pointCloudUrl && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
          <p className="mb-2 font-medium">着色模式</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setColorMode('original');
                applyColorMode('original');
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === 'original' ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20",
                !hasColor && "opacity-50 cursor-not-allowed"
              )}
              disabled={!hasColor}
            >
              🎨 原始颜色
            </button>
            <button
              onClick={() => {
                setColorMode('intensity');
                applyColorMode('intensity');
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === 'intensity' ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20",
                !hasIntensity && "opacity-50 cursor-not-allowed"
              )}
              disabled={!hasIntensity}
            >
              💡 Intensity
            </button>
            <button
              onClick={() => {
                setColorMode('height');
                applyColorMode('height');
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === 'height' ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20"
              )}
            >
              📏 高度 (Z轴)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
