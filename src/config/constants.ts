/**
 * 点云可视化配置常量
 */

// 相机配置
export const CAMERA_CONFIG = {
  FOV: 75,
  NEAR: 0.1,
  FAR: 10000,
  DEFAULT_POSITION: { x: 0, y: 0, z: 50 },
  DEFAULT_UP: { x: 1, y: 0, z: 0 },
} as const;

// OrbitControls 配置
export const CONTROLS_CONFIG = {
  DAMPING_FACTOR: 0.05,
  ROTATE_SPEED: 1.2,
  ZOOM_SPEED: 1.5,
  PAN_SPEED: 1.2,
  MIN_DISTANCE: 0.5,
  MAX_DISTANCE: 10000,
} as const;

// 旋转配置
export const ROTATION_CONFIG = {
  YAW_SPEED: 0.005,
  MIN_DELTA: 1,
} as const;

// 动画配置
export const ANIMATION_CONFIG = {
  RESET_DURATION: 500,
  FPS: 60,
} as const;

// 点云配置
export const POINT_CLOUD_CONFIG = {
  POINT_SIZE: 0.05,
  MAX_POINTS: 1000000,
} as const;

// 颜色配置
export const COLOR_MODES = ['none', 'original', 'intensity', 'height'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

// PCD 颜色通道顺序（RGBA 格式）
export const RGBA_ORDERS = ['rgba', 'bgra', 'argb', 'abgr'] as const;
export type RGBAOrder = (typeof RGBA_ORDERS)[number];

// RGB 通道顺序（RGB 格式，24位）
export const RGB_ORDERS = ['rgb', 'bgr'] as const;
export type RGBOrder = (typeof RGB_ORDERS)[number];

// RGBA 通道顺序映射（大端序）
// RGB  格式打包为 0x00RRGGBB（24位，无 Alpha）
// RGBA 格式打包为 0xRRGGBBAA（32位，含 Alpha）
export const RGBA_ORDER_MAP: Record<RGBAOrder | RGBOrder, { r: number; g: number; b: number }> = {
  // RGBA 格式: 打包为 0xRRGGBBAA
  rgba: { r: 24, g: 16, b: 8 },   // RGBA: R在最高位
  bgra: { r: 8, g: 16, b: 24 },   // BGRA: B在最高位
  argb: { r: 16, g: 8, b: 0 },    // ARGB: A在最高位，R在次高位
  abgr: { r: 0, g: 8, b: 16 },    // ABGR: A在最高位，B在次高位
  // RGB 格式: 打包为 0x00RRGGBB
  rgb: { r: 16, g: 8, b: 0 },     // RGB: R在高位
  bgr: { r: 0, g: 8, b: 16 },     // BGR: B在高位
} as const;

// 文件格式
export const SUPPORTED_POINT_CLOUD_FORMATS = ['pcd'] as const;

// 场景配置
export const SCENE_CONFIG = {
  BACKGROUND_COLOR: 0x1a1a1a,
  AXES_HELPER_SIZE: 50,
  CAMERA_DISTANCE_MULTIPLIER: 2.0,
} as const;

// 控制器扩展配置
export const CONTROLS_EXTENDED_CONFIG = {
  KEY_PAN_SPEED: 10.0,
  AUTO_ROTATE_SPEED: 2.0,
} as const;

// 颜色 Gamma 配置
export const GAMMA_CONFIG = {
  DEFAULT: 0.8,
  MIN: 0.5,
  MAX: 1.5,
  STEP: 0.1,
} as const;

// 默认 4x4 单位矩阵
export const DEFAULT_IDENTITY_MATRIX = `[[1, 0, 0, 0],\n[0, 1, 0, 0],\n[0, 0, 1, 0],\n[0, 0, 0, 1]]`;

// 颜色常量
export const COLOR_VALUES = {
  WHITE: 0xffffff,
  DEFAULT_VERTEX: 0xffffff,
} as const;

// 键盘快捷键
export const KEYBOARD_SHORTCUTS = {
  RESET_VIEW: 'r',
} as const;
