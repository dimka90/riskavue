import { defineConfig } from 'vite';
export default defineConfig({ root: 'app', base: './', envDir: process.cwd(), server: {host:'127.0.0.1', port:5173, proxy:{'/api': 'http://127.0.0.1:3001', '/ws':{target:'ws://127.0.0.1:3001',ws:true}}}, build:{target:'esnext',outDir:'dist'} });
