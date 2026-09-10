import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:path.resolve('pages'),base:'/real-leveling/',publicDir:path.resolve('public'),plugins:[react()],resolve:{alias:{'@':path.resolve('.')}},css:{postcss:path.resolve('.')},build:{outDir:path.resolve('docs'),emptyOutDir:true}});
