/** @type {import('tailwindcss').Config} */
export default {
  // 仅扫描 src 目录，避免与 Ant Design 样式冲突
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // 关闭 Tailwind preflight，避免与 Ant Design 基础样式冲突
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
