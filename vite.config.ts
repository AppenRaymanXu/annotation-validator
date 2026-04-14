import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 Three.js 相关库单独打包
          'three-vendor': ['three', 'three-stdlib'],
          // React 相关库
          'react-vendor': ['react', 'react-dom'],
          // UI 组件库
          'ui-vendor': ['lucide-react', 'class-variance-authority'],
        },
        // 优化chunk文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 启用 sourcemap（生产环境可关闭）
    sourcemap: false,
    // 压缩配置
    minify: 'esbuild',
    // 目标浏览器
    target: 'es2020',
    // 资源内联限制（10KB以下转base64）
    assetsInlineLimit: 10240,
  },
  // 开发服务器优化
  server: {
    // 启用 HMR
    hmr: {
      overlay: true,
    },
    // 代理配置（如需要）
    // proxy: {}
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'three'],
    exclude: [],
  },
})
