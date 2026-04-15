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

// 文件格式
export const SUPPORTED_POINT_CLOUD_FORMATS = ['pcd'] as const;

// 键盘快捷键
export const KEYBOARD_SHORTCUTS = {
  RESET_VIEW: 'r',
} as const;
