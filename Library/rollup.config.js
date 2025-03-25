import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/ai-models-bridge.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ]
  },
  // UMD build (minified)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/ai-models-bridge.min.js',
      format: 'umd',
      name: 'AIModelsBridge',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser()
    ]
  }
];