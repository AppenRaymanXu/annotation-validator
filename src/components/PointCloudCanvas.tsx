import { useRef, useEffect, useState, useCallback, memo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { cn } from '@/lib/utils';

// 生产环境静默的调试日志
const DEBUG = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => { if (DEBUG) console.log('[PointCloud]', ...args); };
import { 
  Annotation, 
  AnnotationType,
  BBox3DAnnotation, 
  Polygon3DAnnotation, 
  Polyline3DAnnotation,
  Point3DAnnotation,
} from '@/types/annotation';
import {
  CAMERA_CONFIG,
  CONTROLS_CONFIG,
  CONTROLS_EXTENDED_CONFIG,
  SCENE_CONFIG,
  GAMMA_CONFIG,
  DEFAULT_IDENTITY_MATRIX,
  COLOR_VALUES,
  ROTATION_CONFIG,
  ANIMATION_CONFIG,
  COLOR_MODES,
  RGBA_ORDER_MAP,
  KEYBOARD_SHORTCUTS,
  type ColorMode,
  type RGBAOrder,
  type RGBOrder,
} from '@/config/constants';
import {
  decompressLZF,
  drawBBox3D,
  drawPolygon3D,
  drawPolyline3D,
  drawPoint3D,
  clearLabelTextureCache,
  disposeObject3D,
  applyColorMode as applyColorModeUtil,
  applyRGBAOrder as applyRGBAOrderUtil,
} from './pointcloud';

interface PointCloudCanvasProps {
  pointCloudUrl: string | null;
  annotations: Annotation[];
  hiddenIds: Set<string>;
  onPointCloudDrop?: (file: File) => void;
  className?: string;
  transformMatrix?: number[] | null; // 4x4 变换矩阵
  onTransformApply?: (matrix: number[]) => void; // 应用变换回调
  onTransformReset?: () => void; // 重置变换回调
  pointCloudFileName?: string; // 点云文件名（替代 window 全局变量）
}

export const PointCloudCanvas = memo(function PointCloudCanvas({ 
  pointCloudUrl, 
  annotations, 
  hiddenIds, 
  onPointCloudDrop,
  className,
  transformMatrix = null,
  onTransformApply,
  onTransformReset,
  pointCloudFileName = '',
}: PointCloudCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const annotationGroupRef = useRef<THREE.Group | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null); // 坐标轴辅助
  const needsRenderRef = useRef<boolean>(true); // 按需渲染标记
  const originalColorsRef = useRef<Float32Array | null>(null); // 保存原始颜色数据
  const originalRGBARef = useRef<Uint32Array | null>(null); // 保存原始 rgba 数据（用于通道切换）
  const annotationPoolRef = useRef<Map<string, THREE.Object3D[]>>(new Map()); // 标注对象池
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('none');
  const colorModeRef = useRef<ColorMode>('none');
  const [hasIntensity, setHasIntensity] = useState(false);
  const [hasColor, setHasColor] = useState(false);
  const [rgbaOrder, setRgbaOrder] = useState<RGBAOrder | RGBOrder>('rgba'); // 颜色通道顺序
  const [colorGamma, setColorGamma] = useState<number>(GAMMA_CONFIG.DEFAULT); // 颜色 Gamma 值（<1 更鲜艳）
  const [showTransformPanel, setShowTransformPanel] = useState(false);
  const [detectedColorFormat, setDetectedColorFormat] = useState<'rgba' | 'rgb' | 'separate' | null>(null); // 检测到的颜色格式
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matrixInput, setMatrixInput] = useState(DEFAULT_IDENTITY_MATRIX);
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
    scene.background = new THREE.Color(SCENE_CONFIG.BACKGROUND_COLOR);
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
    controls.keyPanSpeed = CONTROLS_EXTENDED_CONFIG.KEY_PAN_SPEED;
    
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
    controls.autoRotateSpeed = CONTROLS_EXTENDED_CONFIG.AUTO_ROTATE_SPEED;
    
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
      cameraZ *= SCENE_CONFIG.CAMERA_DISTANCE_MULTIPLIER;
      
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
    const axesHelper = new THREE.AxesHelper(SCENE_CONFIG.AXES_HELPER_SIZE);
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

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
    
    // 监听控制器变化，标记需要渲染
    const onControlsChange = () => {
      needsRenderRef.current = true;
    };
    controls.addEventListener('change', onControlsChange);
    
    const animate = (time: number) => {
      animationId = requestAnimationFrame(animate);
      
      // 帧率控制：限制渲染频率
      const delta = time - lastTime;
      if (delta < frameInterval) return;
      lastTime = time - (delta % frameInterval);
      
      // 只有在需要时才渲染
      if (needsRenderRef.current) {
        controls.update();
        renderer.render(scene, camera);
        needsRenderRef.current = false;
      }
    };
    animate(0);

    // 响应式调整（带防抖）
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!containerRef.current || !camera || !renderer) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        needsRenderRef.current = true;
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    
    // 使用 ResizeObserver 监听容器尺寸变化（如 JSON 编辑器收起/展开）
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 清理函数
    return () => {
      // 取消动画
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // 移除事件监听
      controls.removeEventListener('change', onControlsChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      resizeObserver.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
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
      
      // 清理纹理缓存
      clearLabelTextureCache();
      
      // 清理对象池
      annotationPoolRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 应用颜色通道顺序（不重新加载文件）
  const applyRGBAOrder = useCallback((order: RGBAOrder | RGBOrder, gamma: number = 1.0) => {
    if (!pointCloudRef.current || !originalRGBARef.current) return;
    applyRGBAOrderUtil(
      pointCloudRef.current,
      originalRGBARef.current,
      order,
      gamma,
      originalColorsRef,
      needsRenderRef,
      (mode) => applyColorMode(mode)
    );
  }, []);

  // 应用颜色模式
  const applyColorMode = useCallback((mode: ColorMode) => {
    if (!pointCloudRef.current) return;
    applyColorModeUtil(pointCloudRef.current, mode, originalColorsRef.current, needsRenderRef);
  }, []);

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
      
      // 清空原始颜色缓存
      originalColorsRef.current = null;
      originalRGBARef.current = null;
      
      // 重置颜色模式为不着色（加载新点云时重置）
      colorModeRef.current = 'none';
      setColorMode('none');
      setLoadError(null);

      // 获取文件名（从 prop 或 URL）
      const fileName = pointCloudFileName || url;
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      
      debugLog('加载点云文件:', { fileName, fileExt, url });
      
      let pointCloud: THREE.Points;

      if (fileExt === 'pcd') {
        // 使用 PCDLoader 加载 PCD 文件
        const loader = new PCDLoader();
        
        // 先加载点云
        const points = await new Promise<THREE.Points>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        
        // 处理 PCD 点云的颜色和强度
        const geometry = points.geometry;
        const attributes = geometry.attributes;
        
        let hasColorAttr = !!attributes.color;
        const hasIntensityAttr = !!attributes.intensity;
        let manualColorParsed = false;
        
        debugLog('PCD 加载完成，hasColorAttr:', hasColorAttr, 'attributes:', Object.keys(attributes));
        
        // 如果 PCDLoader 已经解析了颜色，保存到 originalColorsRef
        if (hasColorAttr && attributes.color) {
          const colorArray = attributes.color.array as Float32Array;
          originalColorsRef.current = new Float32Array(colorArray);
          debugLog('PCDLoader 已解析颜色，保存到 originalColorsRef:', originalColorsRef.current.length);
        }
        
        // 检测颜色格式并保存原始数据（无论 PCDLoader 是否已解析颜色）
        try {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const text = new TextDecoder().decode(buffer.slice(0, 2048));
          const headerEnd = text.indexOf('DATA');
          const headerText = text.slice(0, headerEnd);
          const fieldsMatch = /^FIELDS (.*)$/m.exec(headerText);
          const sizesMatch = /^SIZE (.*)$/m.exec(headerText);
          
          if (fieldsMatch && sizesMatch) {
            const fields = fieldsMatch[1].split(' ');
            
            // 大小写不敏感的字段检测
            const fieldsLower = fields.map(f => f.toLowerCase());
            
            // 查找 rgb/rgba 字段索引
            const rgbaIndex = fieldsLower.indexOf('rgba');
            const rgbIndex = fieldsLower.indexOf('rgb');
            
            // === 从 PCDLoader 已解析的颜色属性反推原始字节值 ===
            // PCDLoader 对 rgb/rgba 做了 sRGB→Linear 转换，我们反向转回 sRGB 得到原始字节
            const linearToSRGB = (c: number): number => {
              if (c <= 0.0031308) return c * 12.92;
              return 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
            };

            if ((rgbaIndex >= 0 || rgbIndex >= 0) && hasColorAttr && attributes.color) {
              const isRGBA = rgbaIndex >= 0;
              const formatName = isRGBA ? 'rgba' : 'rgb';
              setDetectedColorFormat(formatName);
              setRgbaOrder(formatName as RGBAOrder | RGBOrder);
              debugLog('检测到颜色格式:', formatName);

              const colorArray = attributes.color.array as Float32Array;
              const positionCount = attributes.position.count;
              const originalPacked = new Uint32Array(positionCount);

              for (let i = 0; i < positionCount; i++) {
                // PCDLoader 输出是 Linear RGB，反转为 sRGB 得到原始字节
                const rLinear = colorArray[i * 3];
                const gLinear = colorArray[i * 3 + 1];
                const bLinear = colorArray[i * 3 + 2];
                const r = Math.round(Math.max(0, Math.min(1, linearToSRGB(rLinear))) * 255);
                const g = Math.round(Math.max(0, Math.min(1, linearToSRGB(gLinear))) * 255);
                const b = Math.round(Math.max(0, Math.min(1, linearToSRGB(bLinear))) * 255);
                if (isRGBA) {
                  // RGBA 格式: 打包为 0xRRGGBBAA（Alpha 默认 0xFF）
                  originalPacked[i] = ((r << 24) | (g << 16) | (b << 8) | 0xFF) >>> 0;
                } else {
                  // RGB 格式: 打包为 0x00RRGGBB
                  originalPacked[i] = (r << 16) | (g << 8) | b;
                }
              }
              originalRGBARef.current = originalPacked;
              debugLog(`从 PCDLoader 颜色反推 ${formatName} 原始字节:`, positionCount,
                'sample:', '0x' + originalPacked[0]?.toString(16).padStart(8, '0'));

              
            } else if ((fieldsLower.includes('r') || fieldsLower.includes('red')) &&
                       (fieldsLower.includes('g') || fieldsLower.includes('green')) &&
                       (fieldsLower.includes('b') || fieldsLower.includes('blue'))) {
              setDetectedColorFormat('separate');
              debugLog('检测到颜色格式: separate (r,g,b)');
            }
          }
        } catch (err) {
          debugLog('检测颜色格式失败:', err);
        }
        
        // 检查是否有 rgba 或 rgb 字段（PCDLoader 不自动处理的情况）
        if (!hasColorAttr) {
          try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const text = new TextDecoder().decode(buffer.slice(0, 2048));
            const headerEnd = text.indexOf('DATA');
            const headerText = text.slice(0, headerEnd);
            
            // 解析字段
            const fieldsMatch = /^FIELDS (.*)$/m.exec(headerText);
            const sizesMatch = /^SIZE (.*)$/m.exec(headerText);
            
            if (fieldsMatch && sizesMatch) {
              const fields = fieldsMatch[1].split(' ');
              const sizes = sizesMatch[1].split(' ').map(Number);
              
              // 大小写不敏感的字段检测辅助函数
              const findFieldIndex = (fieldNames: string[]) => {
                for (let i = 0; i < fields.length; i++) {
                  const fieldLower = fields[i].toLowerCase();
                  if (fieldNames.includes(fieldLower)) {
                    return i;
                  }
                }
                return -1;
              };
              
              // 检查是否有 rgba 字段（支持大小写）
              const rgbaIndex = findFieldIndex(['rgba']);
              const hasRGBA = rgbaIndex >= 0;
              
              // 检查是否有 rgb 字段（打包的 rgb，支持大小写）
              const rgbIndex = findFieldIndex(['rgb']);
              const hasRGBPacked = rgbIndex >= 0;
              
              // 检查是否有分开的颜色字段（支持 r/red, g/green, b/blue，大小写不敏感）
              const rIndex = findFieldIndex(['r', 'red']);
              const gIndex = findFieldIndex(['g', 'green']);
              const bIndex = findFieldIndex(['b', 'blue']);
              const hasRGB = rIndex >= 0 && gIndex >= 0 && bIndex >= 0;
              
              const positionCount = attributes.position.count;
              const colors = new Float32Array(positionCount * 3);
              
              // 检查是否是压缩格式（DATA 行在 headerText 之外，需在 text 中查找）
              const isCompressed = text.includes('DATA binary_compressed');
              debugLog('PCD 格式:', isCompressed ? 'binary_compressed' : 'binary', '字段:', { hasRGBA, hasRGBPacked, hasRGB });
              
              let dataview: DataView;
              
              if (isCompressed) {
                // 压缩格式：需要解压
                const dataStart = text.indexOf('DATA');
                const dataOffset = text.indexOf('\n', dataStart) + 1;
                const compressedData = new Uint8Array(buffer.slice(dataOffset));
                
                // 读取压缩和解压大小（前8字节）
                const lzfHeader = new Uint32Array(compressedData.buffer.slice(0, 8));
                const compressedSize = lzfHeader[0];
                const decompressedSize = lzfHeader[1];
                
                // 解压数据
                const decompressed = decompressLZF(
                  compressedData.slice(8, 8 + compressedSize),
                  decompressedSize
                );
                dataview = new DataView(decompressed.buffer);
                debugLog('LZF 解压:', compressedSize, '->', decompressedSize);
              } else {
                // 非压缩格式
                const dataStart = text.indexOf('\n', text.indexOf('DATA')) + 1;
                dataview = new DataView(buffer.slice(dataStart));
              }
              
              debugLog('PCD 字段检测:', { hasRGBA, hasRGBPacked, hasRGB, fields, rIndex, gIndex, bIndex });
              
              if (hasRGBA) {
                // 解析 rgba 字段
                let rgbaOffset = 0;
                for (let i = 0; i < rgbaIndex; i++) {
                  rgbaOffset += sizes[i];
                }
                const rowSize = sizes.reduce((a, b) => a + b, 0);
                const rgbaFieldSize = sizes[rgbaIndex];
                
                // 保存原始 rgba 数据（用于后续通道切换）
                // PCD 原始字节 [B,G,R,A]，LE uint32 = 0xAARRGGBB
                // 重新打包为标准大端序 RGBA: 0xRRGGBBAA
                const originalRGBA = new Uint32Array(positionCount);
                for (let i = 0; i < positionCount; i++) {
                  // 压缩格式解压后是列主序，非压缩格式是行主序
                  const offset = isCompressed
                    ? rgbaOffset * positionCount + i * rgbaFieldSize
                    : i * rowSize + rgbaOffset;
                  const raw = dataview.getUint32(offset, true); // 0xAARRGGBB
                  const r = (raw >> 16) & 0xFF;
                  const g = (raw >> 8) & 0xFF;
                  const b = raw & 0xFF;
                  const a = (raw >> 24) & 0xFF;
                  originalRGBA[i] = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0; // 0xRRGGBBAA
                }
                originalRGBARef.current = originalRGBA;
                
                // 获取当前选择的颜色通道顺序
                const order = RGBA_ORDER_MAP[rgbaOrder];
                
                for (let i = 0; i < positionCount; i++) {
                  const rgba = originalRGBA[i];
                  // 根据选择的通道顺序解析
                  const r = ((rgba >> order.r) & 0xFF) / 255;
                  const g = ((rgba >> order.g) & 0xFF) / 255;
                  const b = ((rgba >> order.b) & 0xFF) / 255;
                  
                  colors[i * 3] = r;
                  colors[i * 3 + 1] = g;
                  colors[i * 3 + 2] = b;
                }
                
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                originalColorsRef.current = new Float32Array(colors);
                debugLog('手动解析 rgba 颜色成功，通道顺序:', rgbaOrder, '点数:', positionCount);
                manualColorParsed = true;
                setDetectedColorFormat('rgba');
                
              } else if (hasRGBPacked) {
                // 解析 rgb 字段（打包的 rgb，float32 格式，实际存储为 int 的 float 表示）
                let rgbOffset = 0;
                for (let i = 0; i < rgbIndex; i++) {
                  rgbOffset += sizes[i];
                }
                const rowSize = sizes.reduce((a, b) => a + b, 0);
                const rgbFieldSize = sizes[rgbIndex];
                
                // 保存原始 rgb 数据（用于后续通道切换）
                // PCD rgb 字段是 float32，但存储的是 int 的位模式，直接用 getUint32 读取
                // LE 读取后 uint32 值为 0x00RRGGBB，已符合 RGB ORDER_MAP 的位移定义
                const originalRGB = new Uint32Array(positionCount);
                for (let i = 0; i < positionCount; i++) {
                  // 压缩格式解压后是列主序，非压缩格式是行主序
                  const offset = isCompressed
                    ? rgbOffset * positionCount + i * rgbFieldSize
                    : i * rowSize + rgbOffset;
                  originalRGB[i] = dataview.getUint32(offset, true);
                }
                originalRGBARef.current = originalRGB; // 复用同一个 ref
                
                // 获取当前选择的颜色通道顺序（rgb 使用 RGB 顺序，没有 A）
                const order = RGBA_ORDER_MAP[rgbaOrder];
                
                for (let i = 0; i < positionCount; i++) {
                  const rgb = originalRGB[i];
                  // 根据选择的通道顺序解析（rgb 只有 RGB，没有 Alpha）
                  const r = ((rgb >> order.r) & 0xFF) / 255;
                  const g = ((rgb >> order.g) & 0xFF) / 255;
                  const b = ((rgb >> order.b) & 0xFF) / 255;
                  
                  colors[i * 3] = r;
                  colors[i * 3 + 1] = g;
                  colors[i * 3 + 2] = b;
                }
                
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                originalColorsRef.current = new Float32Array(colors);
                debugLog('手动解析 rgb 颜色成功，originalColorsRef:', originalColorsRef.current?.length);
                manualColorParsed = true;
                setDetectedColorFormat('rgb');
                
              } else if (hasRGB) {
                // 解析分开的 r,g,b 字段（使用已检测到的索引）
                let rOffset = 0, gOffset = 0, bOffset = 0;
                for (let i = 0; i < rIndex; i++) rOffset += sizes[i];
                for (let i = 0; i < gIndex; i++) gOffset += sizes[i];
                for (let i = 0; i < bIndex; i++) bOffset += sizes[i];
                
                const rowSize = sizes.reduce((a, b) => a + b, 0);
                const rFieldSize = sizes[rIndex];
                const gFieldSize = sizes[gIndex];
                const bFieldSize = sizes[bIndex];
                
                for (let i = 0; i < positionCount; i++) {
                  // 压缩格式解压后是列主序，非压缩格式是行主序
                  const rOff = isCompressed ? rOffset * positionCount + i * rFieldSize : i * rowSize + rOffset;
                  const gOff = isCompressed ? gOffset * positionCount + i * gFieldSize : i * rowSize + gOffset;
                  const bOff = isCompressed ? bOffset * positionCount + i * bFieldSize : i * rowSize + bOffset;
                  const r = dataview.getFloat32(rOff, true);
                  const g = dataview.getFloat32(gOff, true);
                  const b = dataview.getFloat32(bOff, true);
                  
                  colors[i * 3] = r;
                  colors[i * 3 + 1] = g;
                  colors[i * 3 + 2] = b;
                }
                
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                originalColorsRef.current = new Float32Array(colors);
                debugLog('手动解析 rgb 颜色成功，点数:', positionCount);
                manualColorParsed = true;
                setDetectedColorFormat('separate');
              }
            }
          } catch (err) {
            console.warn('检查颜色字段失败:', err);
          }
        }
        
        debugLog('PCD 属性:', {
          hasColor: hasColorAttr,
          hasIntensity: hasIntensityAttr,
          hasNormal: !!attributes.normal,
          positionCount: attributes.position.count,
          manualColorParsed
        });
        
        setHasColor(hasColorAttr || manualColorParsed);
        setHasIntensity(hasIntensityAttr);
        
        pointCloud = points;
      } else if (fileExt === 'las' || fileExt === 'laz' || fileExt === 'ply') {
        throw new Error(`暂不支持 ${fileExt.toUpperCase()} 格式，请使用 PCD 格式`);
      } else {
        throw new Error(`不支持的文件格式: ${fileExt}，请使用 PCD 格式`);
      }
      sceneRef.current.add(pointCloud);
      pointCloudRef.current = pointCloud;
      
      // 设置材质：默认不着色（加载新点云时重置为白色）
      const material = pointCloud.material as THREE.PointsMaterial;
      material.vertexColors = false;
      material.color.set(COLOR_VALUES.DEFAULT_VERTEX);
      material.needsUpdate = true;

      // 自动调整相机位置 - 保持俯视角度
      const boundingBox = new THREE.Box3().setFromObject(pointCloud);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      
      debugLog('点云信息:', {
        center: { x: center.x, y: center.y, z: center.z },
        size: { x: size.x, y: size.y, z: size.z },
        pointsCount: pointCloud.geometry.attributes.position.count
      });
      
      // 将坐标轴移动到点云中心
      if (axesHelperRef.current) {
        axesHelperRef.current.position.copy(center);
        debugLog('坐标轴已移动到点云中心:', center);
      }
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current!.fov * (Math.PI / 180);
      let cameraZ = maxDim / (2 * Math.tan(fov / 2));
      cameraZ *= SCENE_CONFIG.CAMERA_DISTANCE_MULTIPLIER; // 增加距离以便更好地查看

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
      setLoadError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [pointCloudFileName]);

  // 加载点云文件
  useEffect(() => {
    if (pointCloudUrl) {
      debugLog('开始加载点云:', pointCloudUrl);
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
        console.warn('变换矩阵需要 16 个数字');
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
      console.warn('变换矩阵格式错误:', error);
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
    debugLog('变换矩阵 useEffect:', { 
      hasPointCloud: !!pointCloudRef.current, 
      transformMatrix 
    });
    
    if (!pointCloudRef.current || !transformMatrix) {
      debugLog('跳过变换：', {
        hasPointCloud: !!pointCloudRef.current,
        hasTransformMatrix: !!transformMatrix
      });
      return;
    }

    const geometry = pointCloudRef.current.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    
    // 保存原始位置（如果没有保存过）
    if (!(geometry as any).__originalPositions) {
      debugLog('保存原始位置');
      (geometry as any).__originalPositions = new Float32Array(positions);
    }
    
    const originalPositions = (geometry as any).__originalPositions as Float32Array;
    
    debugLog('开始应用变换矩阵...', {
      pointCount: positions.length / 3,
      matrix: transformMatrix
    });
    
    // 提取矩阵元素到局部变量（避免重复属性访问）
    const [m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23] = transformMatrix;
    
    // 应用 4x4 变换矩阵（优化版）
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      const z = originalPositions[i + 2];
      
      positions[i] = m00 * x + m01 * y + m02 * z + m03;
      positions[i + 1] = m10 * x + m11 * y + m12 * z + m13;
      positions[i + 2] = m20 * x + m21 * y + m22 * z + m23;
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
    cameraZ *= SCENE_CONFIG.CAMERA_DISTANCE_MULTIPLIER;
    
    // 保持俯视角
    cameraRef.current!.position.set(center.x, center.y, center.z + cameraZ);
    cameraRef.current!.up.set(1, 0, 0);
    cameraRef.current!.lookAt(center);
    cameraRef.current!.updateMatrix();
    cameraRef.current!.updateMatrixWorld();
    controlsRef.current!.target.copy(center);
    controlsRef.current!.update();
    
  }, [transformMatrix]);

  // 获取或创建标签纹理（带缓存）- 已提取到 annotationRenderer

  // 更新标注（优化版：增量更新）
  useEffect(() => {
    if (!annotationGroupRef.current) return;

    const currentIds = new Set(annotations.filter(a => !hiddenIds.has(a.id)).map(a => a.id));
    const pool = annotationPoolRef.current;
    
    // 1. 移除不再需要的标注
    const toRemove: string[] = [];
    pool.forEach((objects, id) => {
      if (!currentIds.has(id)) {
        objects.forEach(obj => {
          annotationGroupRef.current!.remove(obj);
          disposeObject3D(obj);
        });
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => pool.delete(id));

    // 2. 添加新标注
    annotations.forEach((annotation) => {
      if (hiddenIds.has(annotation.id)) return;
      if (pool.has(annotation.id)) return;

      const group = annotationGroupRef.current;
      if (!group) return;
      
      const newObjects: THREE.Object3D[] = [];
      const originalAdd = group.add.bind(group);
      group.add = (obj: THREE.Object3D) => {
        newObjects.push(obj);
        return originalAdd(obj);
      };

      switch (annotation.type) {
        case AnnotationType.BBOX_3D:
          drawBBox3D(group, annotation as BBox3DAnnotation);
          break;
        case AnnotationType.POLYGON_3D:
          drawPolygon3D(group, annotation as Polygon3DAnnotation);
          break;
        case AnnotationType.POLYLINE_3D:
          drawPolyline3D(group, annotation as Polyline3DAnnotation);
          break;
        case AnnotationType.POINT_3D:
          drawPoint3D(group, annotation as Point3DAnnotation);
          break;
      }

      group.add = originalAdd;
      pool.set(annotation.id, newObjects);
    });

    needsRenderRef.current = true;
  }, [annotations, hiddenIds]);

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

      {/* 加载错误提示 */}
      {loadError && !isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-900/80 text-white p-4 rounded-lg text-sm max-w-md text-center">
          <p className="font-medium mb-1">加载点云失败</p>
          <p className="text-xs text-red-200">{loadError}</p>
          <p className="text-xs text-red-300 mt-2">请检查文件格式和完整性</p>
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
      {pointCloudUrl && !isLoading && (
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
                colorModeRef.current = COLOR_MODES[0];
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
                colorModeRef.current = COLOR_MODES[1];
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
                colorModeRef.current = COLOR_MODES[2];
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
                colorModeRef.current = COLOR_MODES[3];
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
          
          {/* 颜色通道顺序选择（仅当原始颜色模式、有颜色、且是打包格式时显示） */}
          {hasColor && colorMode === 'original' && detectedColorFormat && detectedColorFormat !== 'separate' && (
            <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
              <div>
                <p className="mb-1 text-[10px] text-gray-400">
                  颜色通道顺序
                </p>
                <select
                  value={rgbaOrder}
                  onChange={(e) => {
                    const newOrder = e.target.value as RGBAOrder | RGBOrder;
                    setRgbaOrder(newOrder);
                    // 直接应用新的通道顺序（不重新加载文件）
                    applyRGBAOrder(newOrder, colorGamma);
                  }}
                  className="w-full px-2 py-1 rounded bg-white/10 text-white text-[10px] border border-white/20 focus:outline-none focus:border-primary"
                >
                  {detectedColorFormat === 'rgb' 
                    ? [
                        { value: 'rgb', label: 'RGB' },
                        { value: 'bgr', label: 'BGR' },
                      ].map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-black">
                          {opt.label}
                        </option>
                      ))
                    : [
                        { value: 'rgba', label: 'RGBA' },
                        { value: 'bgra', label: 'BGRA' },
                        { value: 'argb', label: 'ARGB' },
                        { value: 'abgr', label: 'ABGR' },
                      ].map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-black">
                          {opt.label}
                        </option>
                      ))
                  }
                </select>
              </div>
              
              <div>
                <p className="mb-1 text-[10px] text-gray-400">颜色鲜艳度 (Gamma)</p>
                <input
                  type="range"
                  min={GAMMA_CONFIG.MIN}
                  max={GAMMA_CONFIG.MAX}
                  step={GAMMA_CONFIG.STEP}
                  value={colorGamma}
                  onChange={(e) => {
                    const newGamma = parseFloat(e.target.value);
                    setColorGamma(newGamma);
                    applyRGBAOrder(rgbaOrder, newGamma);
                  }}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>鲜艳</span>
                  <span>{colorGamma.toFixed(1)}</span>
                  <span>暗淡</span>
                </div>
              </div>
            </div>
          )}
          
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
