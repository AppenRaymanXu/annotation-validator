import { useRef, useEffect, useState, useCallback, memo } from 'react';
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
import {
  CAMERA_CONFIG,
  CONTROLS_CONFIG,
  ROTATION_CONFIG,
  ANIMATION_CONFIG,
  COLOR_MODES,
  KEYBOARD_SHORTCUTS,
  type ColorMode,
} from '@/config/constants';

interface PointCloudCanvasProps {
  pointCloudUrl: string | null;
  annotations: Annotation[];
  hiddenIds: Set<string>;
  onPointCloudDrop?: (file: File) => void;
  className?: string;
  transformMatrix?: number[] | null; // 4x4 变换矩阵
  onTransformApply?: (matrix: number[]) => void; // 应用变换回调
  onTransformReset?: () => void; // 重置变换回调
}

export const PointCloudCanvas = memo(function PointCloudCanvas({ 
  pointCloudUrl, 
  annotations, 
  hiddenIds, 
  onPointCloudDrop,
  className,
  transformMatrix = null,
  onTransformApply,
  onTransformReset
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
  const [colorMode, setColorMode] = useState<ColorMode>('none');
  const [hasIntensity, setHasIntensity] = useState(false);
  const [hasColor, setHasColor] = useState(false);
  const [showTransformPanel, setShowTransformPanel] = useState(false);
  const [matrixInput, setMatrixInput] = useState(`[[1, 0, 0, 0],
 [0, 1, 0, 0],
 [0, 0, 1, 0],
 [0, 0, 0, 1]]`);
  const [transformInfo, setTransformInfo] = useState<{ 
    before: [number, number, number]; 
    after: [number, number, number];
    offset: [number, number, number];
  } | null>(null);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // 相机 - 右手坐标系：X向前，Y向左，Z向上
    const camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.FOV,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      CAMERA_CONFIG.NEAR,
      CAMERA_CONFIG.FAR
    );
    // 俯视角：X 轴向上（屏幕上方），Y 轴向左（屏幕左方），Z 轴朝向观察者（屏幕外）
    camera.position.set(
      CAMERA_CONFIG.DEFAULT_POSITION.x,
      CAMERA_CONFIG.DEFAULT_POSITION.y,
      CAMERA_CONFIG.DEFAULT_POSITION.z
    );
    camera.up.set(
      CAMERA_CONFIG.DEFAULT_UP.x,
      CAMERA_CONFIG.DEFAULT_UP.y,
      CAMERA_CONFIG.DEFAULT_UP.z
    );
    camera.lookAt(0, 0, 0);
    // 确保相机的旋转矩阵正确
    camera.updateMatrix();
    camera.updateMatrixWorld();
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 控制器 - 右手坐标系，增强旋转功能
    const controls = new OrbitControls(camera, renderer.domElement);
    
    // 启用阻尼效果，使旋转更平滑
    controls.enableDamping = true;
    controls.dampingFactor = CONTROLS_CONFIG.DAMPING_FACTOR;
    
    // 旋转设置 - 优化拖动体验
    controls.rotateSpeed = CONTROLS_CONFIG.ROTATE_SPEED;
    controls.enableRotate = true;
    
    // 缩放设置
    controls.enableZoom = true;
    controls.zoomSpeed = CONTROLS_CONFIG.ZOOM_SPEED;
    controls.minDistance = CONTROLS_CONFIG.MIN_DISTANCE;
    controls.maxDistance = CONTROLS_CONFIG.MAX_DISTANCE;
    
    // 平移设置 - 优化拖动体验
    controls.enablePan = true;
    controls.panSpeed = CONTROLS_CONFIG.PAN_SPEED;
    controls.keyPanSpeed = 10.0;
    
    // 旋转限制 - 允许完整 360 度旋转
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    
    // 鼠标按钮配置 - 更符合直觉
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    
    // 触摸配置 - 移动端友好
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    
    // 目标点设置
    controls.target.set(0, 0, 0);
    controls.update();
    
    // 自动旋转（默认关闭）
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.0;
    
    controlsRef.current = controls;

    // Shift + 鼠标拖动 = 绕Z轴旋转（偏航角 Yaw）
    let isYawRotating = false;
    let lastYawMouseX = 0;
    const yawRotationSpeed = ROTATION_CONFIG.YAW_SPEED;
    
    const handleYawMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && e.button === 0) {
        isYawRotating = true;
        lastYawMouseX = e.clientX;
        // 禁用 OrbitControls
        controls.enableRotate = false;
        controls.enablePan = false;
      }
    };
    
    const handleYawMouseMove = (e: MouseEvent) => {
      if (!isYawRotating) return;
      
      const deltaX = e.clientX - lastYawMouseX;
      if (Math.abs(deltaX) < ROTATION_CONFIG.MIN_DELTA) return;
      
      // 计算旋转角度
      const angle = -deltaX * yawRotationSpeed;
      
      // 获取相机到目标点的向量
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      
      // 创建Z轴旋转的四元数（世界坐标系的Z轴）
      const zAxis = new THREE.Vector3(0, 0, 1);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(zAxis, angle);
      
      // 旋转偏移向量
      offset.applyQuaternion(quaternion);
      
      // 更新相机位置
      camera.position.copy(controls.target).add(offset);
      
      // 更新相机的up向量
      const up = camera.up.clone();
      up.applyQuaternion(quaternion);
      camera.up.copy(up);
      
      camera.lookAt(controls.target);
      controls.update();
      
      lastYawMouseX = e.clientX;
    };
    
    const handleYawMouseUp = () => {
      if (isYawRotating) {
        isYawRotating = false;
        // 恢复 OrbitControls
        controls.enableRotate = true;
        controls.enablePan = true;
      }
    };
    
    if (containerRef.current) {
      containerRef.current.addEventListener('mousedown', handleYawMouseDown, true);
      containerRef.current.addEventListener('mousemove', handleYawMouseMove, true);
      containerRef.current.addEventListener('mouseup', handleYawMouseUp, true);
      containerRef.current.addEventListener('mouseleave', handleYawMouseUp, true);
    }

    // R键重置视角
    const handleResetView = () => {
      if (!pointCloudRef.current || !camera || !controls) return;
      
      // 重新计算点云边界框
      const boundingBox = new THREE.Box3().setFromObject(pointCloudRef.current);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      
      // 计算合适的相机距离
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = maxDim / (2 * Math.tan(fov / 2));
      cameraZ *= 2.0;
      
      // 平滑过渡到新视角
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const endPos = new THREE.Vector3(center.x, center.y, center.z + cameraZ);
      const endTarget = center.clone();
      
      const duration = ANIMATION_CONFIG.RESET_DURATION; // ms 动画
      const startTime = Date.now();
      
      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 缓动函数 (ease-in-out)
        const ease = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        controls.update();
        
        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        }
      };
      
      animateCamera();
    };
    
    // R键监听
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === KEYBOARD_SHORTCUTS.RESET_VIEW) {
        handleResetView();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

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

    // 动画循环（带帧率控制）
    let animationId: number;
    const frameInterval = 1000 / ANIMATION_CONFIG.FPS;
    let lastTime = 0;
    let needsRender = true; // 标记是否需要渲染
    
    // 监听控制器变化，标记需要渲染
    controls.addEventListener('change', () => {
      needsRender = true;
    });
    
    const animate = (time: number) => {
      animationId = requestAnimationFrame(animate);
      
      // 帧率控制：限制渲染频率
      const delta = time - lastTime;
      if (delta < frameInterval) return;
      lastTime = time - (delta % frameInterval);
      
      // 只有在需要时才渲染
      if (needsRender) {
        controls.update();
        renderer.render(scene, camera);
        needsRender = false;
      }
    };
    animate(0);

    // 响应式调整
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      // 取消动画
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // 移除事件监听
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleYawMouseDown, true);
        containerRef.current.removeEventListener('mousemove', handleYawMouseMove, true);
        containerRef.current.removeEventListener('mouseup', handleYawMouseUp, true);
        containerRef.current.removeEventListener('mouseleave', handleYawMouseUp, true);
      }
      
      // 清理 Three.js 资源
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      
      // 释放渲染器
      renderer.dispose();
      
      // 清理场景中的对象
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        } else if (object instanceof THREE.Points) {
          object.geometry?.dispose();
          if (object.material) {
            object.material.dispose();
          }
        } else if (object instanceof THREE.Line) {
          object.geometry?.dispose();
          if (object.material) {
            object.material.dispose();
          }
        }
      });
      
      // 清空引用
      scene.clear();
      controls.dispose();
    };
  }, []);

  // 应用颜色模式
  const applyColorMode = useCallback((mode: 'none' | 'original' | 'intensity' | 'height') => {
    if (!pointCloudRef.current) return;
    
    const geometry = pointCloudRef.current.geometry;
    const attributes = geometry.attributes;
    const positionArray = attributes.position.array as Float32Array;
    
    // 移除颜色属性（默认白色）
    if (attributes.color) {
      geometry.deleteAttribute('color');
    }
    
    if (mode === 'none') {
      // 不着色，使用默认白色
      console.log('不着色模式');
    } else if (mode === 'original' && attributes.color) {
      // 如果有原始颜色，重新添加
      // 这里需要保存原始颜色，简化处理：重新加载
      console.log('使用原始颜色');
    } else if (mode === 'intensity' && attributes.intensity) {
      // 使用 intensity 着色 - 使用彩色渐变（热力图风格）
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
        // 应用 gamma 校正提高对比度
        normalized = Math.pow(normalized, 0.7);
        
        // 使用彩色渐变：蓝 -> 青 -> 绿 -> 黄 -> 红
        if (normalized < 0.25) {
          // 蓝到青
          const t = normalized / 0.25;
          colors[i * 3] = 0;                    // R
          colors[i * 3 + 1] = t;                // G
          colors[i * 3 + 2] = 1;                // B
        } else if (normalized < 0.5) {
          // 青到绿
          const t = (normalized - 0.25) / 0.25;
          colors[i * 3] = 0;                    // R
          colors[i * 3 + 1] = 1;                // G
          colors[i * 3 + 2] = 1 - t;            // B
        } else if (normalized < 0.75) {
          // 绿到黄
          const t = (normalized - 0.5) / 0.25;
          colors[i * 3] = t;                    // R
          colors[i * 3 + 1] = 1;                // G
          colors[i * 3 + 2] = 0;                // B
        } else {
          // 黄到红
          const t = (normalized - 0.75) / 0.25;
          colors[i * 3] = 1;                    // R
          colors[i * 3 + 1] = 1 - t;            // G
          colors[i * 3 + 2] = 0;                // B
        }
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
              
              // 默认不着色，让用户自己选择
              setColorMode('none');
              
              resolve(points);
            },
            undefined,
            (error: unknown) => reject(error)
          );
        });
      } else if (fileExt === 'ply' || fileExt === 'las') {
        throw new Error(`暂不支持 ${fileExt.toUpperCase()} 格式，请使用 PCD 格式`);
      } else {
        throw new Error(`不支持的文件格式: ${fileExt}，请使用 PCD 格式`);
      }
      sceneRef.current.add(pointCloud);
      pointCloudRef.current = pointCloud;

      // 自动调整相机位置 - 保持俯视角度
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

      // 保持俯视角：X 轴向上，Y 轴向左，Z 轴朝向观察者
      cameraRef.current!.position.set(center.x, center.y, center.z + cameraZ);
      cameraRef.current!.up.set(1, 0, 0); // X 轴向上
      cameraRef.current!.lookAt(center);
      // 确保相机矩阵更新
      cameraRef.current!.updateMatrix();
      cameraRef.current!.updateMatrixWorld();
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

  // 处理应用变换
  const handleApplyTransform = () => {
    try {
      let allValues: number[] = [];
      
      // 尝试解析为嵌套数组格式 [[...], [...], [...], [...]]
      const trimmed = matrixInput.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length === 4) {
            // 展平 4x4 数组
            allValues = parsed.flat();
          }
        } catch {
          // 如果 JSON 解析失败，继续尝试其他格式
        }
      }
      
      // 如果不是嵌套数组格式，按多行/逗号解析
      if (allValues.length === 0) {
        allValues = matrixInput
          .split(/[\n,]+/)  // 按换行符或逗号分割
          .map(v => v.trim())
          .filter(v => v !== '')
          .map(v => parseFloat(v));
      }
      
      if (allValues.length !== 16 || allValues.some(isNaN)) {
        alert('请输入 16 个数字（4x4 矩阵）');
        return;
      }
      
      // 记录变换前的中心点
      if (pointCloudRef.current) {
        const boundingBox = new THREE.Box3().setFromObject(pointCloudRef.current);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const beforeCenter: [number, number, number] = [center.x, center.y, center.z];
        
        // 从变换矩阵中提取平移量
        const translation: [number, number, number] = [allValues[3], allValues[7], allValues[11]];
        
        // 应用变换
        onTransformApply?.(allValues);
        
        // 计算理论上的变换后中心点
        const afterCenter: [number, number, number] = [
          beforeCenter[0] + translation[0],
          beforeCenter[1] + translation[1],
          beforeCenter[2] + translation[2]
        ];
        
        setTransformInfo({
          before: beforeCenter,
          after: afterCenter,
          offset: translation
        });
      } else {
        onTransformApply?.(allValues);
      }
    } catch (error) {
      alert('变换矩阵格式错误');
    }
  };

  // 处理重置变换
  const handleResetTransform = () => {
    setMatrixInput(`[[1, 0, 0, 0],
 [0, 1, 0, 0],
 [0, 0, 1, 0],
 [0, 0, 0, 1]]`);
    setTransformInfo(null);
    onTransformReset?.();
  };

  // 应用变换矩阵
  useEffect(() => {
    console.log('变换矩阵 useEffect:', { 
      hasPointCloud: !!pointCloudRef.current, 
      transformMatrix 
    });
    
    if (!pointCloudRef.current || !transformMatrix) {
      console.log('跳过变换：', {
        hasPointCloud: !!pointCloudRef.current,
        hasTransformMatrix: !!transformMatrix
      });
      return;
    }

    const geometry = pointCloudRef.current.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    
    // 保存原始位置（如果没有保存过）
    if (!(geometry as any).__originalPositions) {
      console.log('保存原始位置');
      (geometry as any).__originalPositions = new Float32Array(positions);
    }
    
    const originalPositions = (geometry as any).__originalPositions as Float32Array;
    
    console.log('开始应用变换矩阵...', {
      pointCount: positions.length / 3,
      matrix: transformMatrix
    });
    
    // 应用 4x4 变换矩阵
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      const z = originalPositions[i + 2];
      
      // 矩阵变换: [x', y', z', 1] = M * [x, y, z, 1]
      positions[i] = transformMatrix[0] * x + transformMatrix[1] * y + transformMatrix[2] * z + transformMatrix[3];
      positions[i + 1] = transformMatrix[4] * x + transformMatrix[5] * y + transformMatrix[6] * z + transformMatrix[7];
      positions[i + 2] = transformMatrix[8] * x + transformMatrix[9] * y + transformMatrix[10] * z + transformMatrix[11];
    }
    
    geometry.attributes.position.needsUpdate = true;
    
    // 重新计算包围球
    geometry.computeBoundingSphere();
    
    // 重新调整相机视角以适应变换后的点云
    const boundingBox = new THREE.Box3().setFromObject(pointCloudRef.current);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current!.fov * (Math.PI / 180);
    let cameraZ = maxDim / (2 * Math.tan(fov / 2));
    cameraZ *= 2.0;
    
    // 保持俯视角
    cameraRef.current!.position.set(center.x, center.y, center.z + cameraZ);
    cameraRef.current!.up.set(1, 0, 0);
    cameraRef.current!.lookAt(center);
    cameraRef.current!.updateMatrix();
    cameraRef.current!.updateMatrixWorld();
    controlsRef.current!.target.copy(center);
    controlsRef.current!.update();
    
    console.log('变换完成！');
  }, [transformMatrix]);

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
      if (['pcd', 'ply', 'las', 'laz'].includes(ext || '')) {
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

      {/* 操作提示 */}
      {pointCloudUrl && !isLoading && (
        <div className="absolute bottom-4 right-4 z-10 bg-black/70 text-white p-3 rounded-lg text-xs backdrop-blur-sm pointer-events-none">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 左键拖动</span>
              <span className="text-gray-300">旋转</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 右键拖动</span>
              <span className="text-gray-300">平移</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 滚轮</span>
              <span className="text-gray-300">缩放</span>
            </div>
            <div className="flex items-center gap-2 border-t border-gray-600 pt-1 mt-1">
              <span className="font-medium">👆 双击</span>
              <span className="text-gray-300">重置视角</span>
            </div>
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
            <p className="mt-1 text-xs text-gray-500">支持 PCD 格式（PLY、LAS 即将支持）</p>
          </div>
        </div>
      )}

      {/* 操作提示 */}
      {pointCloudUrl && (
        <div className="absolute bottom-4 right-4 z-10 bg-black/70 text-white p-3 rounded-lg text-xs backdrop-blur-sm pointer-events-none">
          <div className="space-y-1">
            <div className="text-gray-400 font-medium mb-1">基础操作</div>
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 左键拖动</span>
              <span className="text-gray-300">俯仰角 + 翻滚角</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 右键拖动</span>
              <span className="text-gray-300">平移</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">🖱️ 滚轮</span>
              <span className="text-gray-300">缩放</span>
            </div>
            <div className="border-t border-gray-600 my-1"></div>
            <div className="text-gray-400 font-medium mb-1">组合键</div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Shift + 左键拖动</span>
              <span className="text-gray-300">偏航角旋转</span>
            </div>
            <div className="border-t border-gray-600 my-1"></div>
            <div className="flex items-center gap-2">
              <span className="font-medium">R 键</span>
              <span className="text-gray-300">重置视角</span>
            </div>
          </div>
        </div>
      )}

      {/* 颜色模式切换 */}
      {pointCloudUrl && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
          <p className="mb-2 font-medium">着色模式</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setColorMode(COLOR_MODES[0]);
                applyColorMode(COLOR_MODES[0]);
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === COLOR_MODES[0] ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20"
              )}
            >
              ⚪ 不着色
            </button>
            <button
              onClick={() => {
                setColorMode(COLOR_MODES[1]);
                applyColorMode(COLOR_MODES[1]);
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === COLOR_MODES[1] ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20",
                !hasColor && "opacity-50 cursor-not-allowed"
              )}
              disabled={!hasColor}
            >
              🎨 原始颜色
            </button>
            <button
              onClick={() => {
                setColorMode(COLOR_MODES[2]);
                applyColorMode(COLOR_MODES[2]);
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === COLOR_MODES[2] ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20",
                !hasIntensity && "opacity-50 cursor-not-allowed"
              )}
              disabled={!hasIntensity}
            >
              💡 Intensity
            </button>
            <button
              onClick={() => {
                setColorMode(COLOR_MODES[3]);
                applyColorMode(COLOR_MODES[3]);
              }}
              className={cn(
                "px-2 py-1 rounded transition-colors text-left",
                colorMode === COLOR_MODES[3] ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20"
              )}
            >
              📏 高度 (Z轴)
            </button>
          </div>
          
          {/* 变换按钮 */}
          <div className="mt-3 pt-3 border-t border-white/20">
            <button
              onClick={() => setShowTransformPanel(!showTransformPanel)}
              className={cn(
                "w-full px-2 py-1.5 rounded transition-colors text-left flex items-center gap-2",
                showTransformPanel ? "bg-primary text-primary-foreground" : "bg-white/10 hover:bg-white/20"
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>坐标变换</span>
            </button>
          </div>
        </div>
      )}

      {/* 变换面板 */}
      {showTransformPanel && pointCloudUrl && (
        <div className="absolute top-4 left-4 bg-black/90 text-white p-4 rounded-lg text-xs backdrop-blur-sm w-80 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">4x4 变换矩阵</h3>
            <button
              onClick={() => setShowTransformPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <textarea
            value={matrixInput}
            onChange={(e) => setMatrixInput(e.target.value)}
            className="w-full h-28 p-2 text-xs font-mono bg-gray-800 border border-gray-600 rounded resize-none focus:outline-none focus:border-primary"
            placeholder={`[[1, 0, 0, 0],
 [0, 1, 0, 0],
 [0, 0, 1, 0],
 [0, 0, 0, 1]]`}
          />
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApplyTransform}
              className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              应用变换
            </button>
            <button
              onClick={handleResetTransform}
              className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              重置
            </button>
          </div>

          {/* 变换验证信息 */}
          {transformInfo && (
            <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded space-y-2">
              <p className="text-green-300 font-medium">✓ 变换验证</p>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">变换前:</span>
                  <span className="text-green-300">
                    ({transformInfo.before[0].toFixed(2)}, {transformInfo.before[1].toFixed(2)}, {transformInfo.before[2].toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">变换后:</span>
                  <span className="text-green-300">
                    ({transformInfo.after[0].toFixed(2)}, {transformInfo.after[1].toFixed(2)}, {transformInfo.after[2].toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between border-t border-green-700 pt-1">
                  <span className="text-gray-400">偏移量:</span>
                  <span className="text-yellow-300">
                    ({transformInfo.offset[0].toFixed(2)}, {transformInfo.offset[1].toFixed(2)}, {transformInfo.offset[2].toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-700">
            <h4 className="text-gray-400 mb-2">预设矩阵</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMatrixInput(`[[1, 0, 0, 0],
 [0, 1, 0, 0],
 [0, 0, 1, 0],
 [0, 0, 0, 1]]`)}
                className="px-2 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-left text-[10px]"
              >
                单位矩阵
              </button>
              <button
                onClick={() => setMatrixInput(`[[0,-1, 0, 0],
 [1, 0, 0, 0],
 [0, 0, 1, 0],
 [0, 0, 0, 1]]`)}
                className="px-2 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-left text-[10px]"
              >
                绕Z轴90°
              </button>
              <button
                onClick={() => setMatrixInput(`[[1, 0, 0, 0],
 [0, 0,-1, 0],
 [0, 1, 0, 0],
 [0, 0, 0, 1]]`)}
                className="px-2 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-left text-[10px]"
              >
                绕X轴90°
              </button>
              <button
                onClick={() => setMatrixInput(`[[0, 0, 1, 0],
 [0, 1, 0, 0],
 [-1, 0, 0, 0],
 [0, 0, 0, 1]]`)}
                className="px-2 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors text-left text-[10px]"
              >
                绕Y轴90°
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-700 text-gray-400">
            <p className="font-medium text-gray-300 mb-2">矩阵格式：</p>
            <pre className="bg-gray-800 p-2 rounded text-[10px] font-mono">
{`[R00, R01, R02, Tx]
[R10, R11, R12, Ty]
[R20, R21, R22, Tz]
[  0,   0,   0,  1]`}
            </pre>
            <p className="mt-2 text-[10px]">R = 旋转, T = 平移</p>
          </div>
        </div>
      )}
    </div>
  );
});
