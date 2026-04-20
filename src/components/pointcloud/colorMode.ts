/**
 * 点云颜色模式处理工具
 * 负责着色模式切换（none/original/intensity/height）
 */
import * as THREE from 'three';
import { RGBA_ORDER_MAP } from '@/config/constants';
import type { ColorMode, RGBAOrder, RGBOrder } from '@/config/constants';

/** 应用颜色模式到点云 */
export function applyColorMode(
  pointCloud: THREE.Points,
  mode: ColorMode,
  originalColors: Float32Array | null,
  needsRenderRef: React.MutableRefObject<boolean>
) {
  const geometry = pointCloud.geometry;
  const positionArray = geometry.attributes.position.array as Float32Array;

  // 先移除旧的 color 属性（除了 original 模式）
  if (mode !== 'original' && geometry.hasAttribute('color')) {
    geometry.deleteAttribute('color');
  }

  if (mode === 'none') {
    // 不着色
  } else if (mode === 'original') {
    if (!originalColors) {
      console.warn('没有原始颜色数据');
      return;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(originalColors, 3));
  } else if (mode === 'intensity') {
    const intensityAttr = geometry.attributes.intensity;
    if (!intensityAttr) return;
    const intensityArray = intensityAttr.array as Float32Array;
    const colors = new Float32Array(positionArray.length);

    let minIntensity = Infinity;
    let maxIntensity = -Infinity;
    for (let i = 0; i < intensityArray.length; i++) {
      minIntensity = Math.min(minIntensity, intensityArray[i]);
      maxIntensity = Math.max(maxIntensity, intensityArray[i]);
    }

    const range = maxIntensity - minIntensity || 1;
    for (let i = 0; i < intensityArray.length; i++) {
      let normalized = (intensityArray[i] - minIntensity) / range;
      normalized = Math.pow(normalized, 0.7);

      if (normalized < 0.25) {
        const t = normalized / 0.25;
        colors[i * 3] = 0; colors[i * 3 + 1] = t; colors[i * 3 + 2] = 1;
      } else if (normalized < 0.5) {
        const t = (normalized - 0.25) / 0.25;
        colors[i * 3] = 0; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1 - t;
      } else if (normalized < 0.75) {
        const t = (normalized - 0.5) / 0.25;
        colors[i * 3] = t; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0;
      } else {
        const t = (normalized - 0.75) / 0.25;
        colors[i * 3] = 1; colors[i * 3 + 1] = 1 - t; colors[i * 3 + 2] = 0;
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  } else if (mode === 'height') {
    const colors = new Float32Array(positionArray.length);

    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < positionArray.length; i += 3) {
      minZ = Math.min(minZ, positionArray[i + 2]);
      maxZ = Math.max(maxZ, positionArray[i + 2]);
    }

    const range = maxZ - minZ || 1;
    for (let i = 0; i < positionArray.length; i += 3) {
      let normalized = (positionArray[i + 2] - minZ) / range;
      normalized = Math.pow(normalized, 0.7);
      colors[i] = Math.pow(normalized, 0.8);
      colors[i + 1] = 0.3 + normalized * 0.7;
      colors[i + 2] = Math.pow(1 - normalized, 0.8);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  // 更新材质
  const material = pointCloud.material as THREE.PointsMaterial;
  if (mode === 'none') {
    material.vertexColors = false;
    material.color.set(0xffffff);
  } else {
    material.vertexColors = true;
    material.color.set(0xffffff);
  }
  material.needsUpdate = true;

  needsRenderRef.current = true;
}

/** 应用 RGBA 通道顺序 */
export function applyRGBAOrder(
  pointCloud: THREE.Points,
  originalRGBA: Uint32Array,
  order: RGBAOrder | RGBOrder,
  gamma: number,
  originalColorsRef: React.MutableRefObject<Float32Array | null>,
  needsRenderRef: React.MutableRefObject<boolean>,
  _applyColorModeFn: (mode: ColorMode) => void
) {
  const geometry = pointCloud.geometry;
  const positionCount = originalRGBA.length;
  const colors = new Float32Array(positionCount * 3);

  const orderMap = RGBA_ORDER_MAP[order];

  for (let i = 0; i < positionCount; i++) {
    const packed = originalRGBA[i];
    const r = ((packed >> orderMap.r) & 0xFF) / 255;
    const g = ((packed >> orderMap.g) & 0xFF) / 255;
    const b = ((packed >> orderMap.b) & 0xFF) / 255;

    colors[i * 3] = Math.pow(r, gamma);
    colors[i * 3 + 1] = Math.pow(g, gamma);
    colors[i * 3 + 2] = Math.pow(b, gamma);
  }

  // 更新几何体颜色属性 - 优先复用现有 BufferAttribute 避免 GPU 缓冲不同步
  const existingColorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (existingColorAttr && existingColorAttr.count === positionCount && existingColorAttr.itemSize === 3) {
    const arr = existingColorAttr.array as Float32Array;
    arr.set(colors);
    existingColorAttr.needsUpdate = true;
  } else {
    geometry.deleteAttribute('color');
    const newAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('color', newAttr);
    newAttr.needsUpdate = true;
  }

  // 保存到 originalColorsRef 以便后续模式切换使用
  originalColorsRef.current = new Float32Array(colors);

  // 确保材质状态正确
  const material = pointCloud.material as THREE.PointsMaterial;
  material.vertexColors = true;
  material.color.set(0xffffff);
  material.needsUpdate = true;

  needsRenderRef.current = true;
}
