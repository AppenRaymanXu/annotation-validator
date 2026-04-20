/**
 * 3D 标注渲染工具函数
 * 负责将标注数据渲染为 Three.js 对象
 */
import * as THREE from 'three';
import {
  BBox3DAnnotation,
  Polygon3DAnnotation,
  Polyline3DAnnotation,
  Point3DAnnotation,
  getLabelColor,
} from '@/types/annotation';

/** 标签纹理缓存 */
const labelTextureCache = new Map<string, THREE.CanvasTexture>();

/** 获取或创建标签纹理（带缓存） */
export function getLabelTexture(label: string, colorHex: string): THREE.CanvasTexture {
  const cacheKey = `${label}_${colorHex}`;
  if (labelTextureCache.has(cacheKey)) {
    return labelTextureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Failed to get canvas context');

  canvas.width = 256;
  canvas.height = 64;
  context.fillStyle = colorHex;
  context.fillRect(0, 0, 256, 64);
  context.fillStyle = '#ffffff';
  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  labelTextureCache.set(cacheKey, texture);
  return texture;
}

/** 清理所有标签纹理缓存 */
export function clearLabelTextureCache() {
  labelTextureCache.forEach(texture => texture.dispose());
  labelTextureCache.clear();
}

/** 绘制 3D 边界框 */
export function drawBBox3D(group: THREE.Group, annotation: BBox3DAnnotation) {
  const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));
  const colorHex = '#' + color.getHexString();
  const { center, dimensions, rotation } = annotation;
  const [length, width, height] = dimensions;

  // 创建边界框几何体
  const geometry = new THREE.BoxGeometry(length, height, width);

  // 创建线框材质
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });

  const wireframe = new THREE.LineSegments(edges, material);
  wireframe.position.set(center.x, center.y, center.z);

  // 设置旋转
  const rotationType = annotation.rotationType || 'euler';
  if (rotationType === 'euler') {
    const [roll, pitch, yaw] = rotation as [number, number, number];
    wireframe.rotation.set(roll, pitch, yaw);
  } else {
    const quaternion = rotation as unknown as [number, number, number, number];
    wireframe.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  }

  group.add(wireframe);

  // 添加标签
  const texture = getLabelTexture(annotation.label, colorHex);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(center.x, center.y + height / 2 + 1, center.z);
  sprite.scale.set(4, 1, 1);
  group.add(sprite);

  // 清理临时几何体（edges 和 box 几何体会被 wireframe 引用，不能在此处 dispose）
  geometry.dispose();
}

/** 绘制 3D 多边形 */
export function drawPolygon3D(group: THREE.Group, annotation: Polygon3DAnnotation) {
  if (annotation.points.length < 3) return;

  const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

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
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  mesh.position.y = avgY;
  mesh.rotation.x = -Math.PI / 2;
  group.add(mesh);

  // 添加边框
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMaterial = new THREE.LineBasicMaterial({ color });
  const wireframe = new THREE.LineSegments(edges, lineMaterial);
  wireframe.position.y = avgY;
  wireframe.rotation.x = -Math.PI / 2;
  group.add(wireframe);
}

/** 绘制 3D 折线 */
export function drawPolyline3D(group: THREE.Group, annotation: Polyline3DAnnotation) {
  if (annotation.points.length < 2) return;

  const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(annotation.points.length * 3);
  annotation.points.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const line = new THREE.Line(geometry, material);
  group.add(line);

  // 绘制端点
  annotation.points.forEach((point) => {
    const sphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(point.x, point.y, point.z);
    group.add(sphere);
  });
}

/** 绘制 3D 点 */
export function drawPoint3D(group: THREE.Group, annotation: Point3DAnnotation) {
  const color = new THREE.Color(annotation.color || getLabelColor(annotation.label, 0));

  const geometry = new THREE.SphereGeometry(0.3, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(annotation.point.x, annotation.point.y, annotation.point.z);
  group.add(sphere);
}

/** 释放 Three.js 对象的几何体和材质 */
export function disposeObject3D(obj: THREE.Object3D) {
  if ((obj as any).geometry) (obj as any).geometry.dispose();
  if ((obj as any).material) {
    const mat = (obj as any).material;
    if (mat.map) mat.map.dispose();
    mat.dispose();
  }
}
