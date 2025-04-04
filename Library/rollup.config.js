import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const config = [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/ai-models-bridge.esm.js',
        format: 'es'
      },
      {
        file: 'dist/ai-models-bridge.min.js',
        format: 'iife',
        name: 'AIModelsBridge'
      }
    ],
    plugins: [
      nodeResolve({
        browser: true
      }),
      commonjs(),
      typescript(),
      terser()
    ]
  }
];

export default config;