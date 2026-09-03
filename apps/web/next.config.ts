import type { NextConfig } from 'next';
import path from 'path';
import fs from 'fs';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  webpack: (config, { isServer }) => {
    // Next.js 15 genera por defecto archivos del Pages Router (_document.js,
    // _app.js, _error.js) incluso en proyectos App Router puros. Durante
    // next dev, la limpieza de caché puede borrar .next/server/pages/_document.js
    // antes de que el compilador del Pages Router lo regenere, provocando un
    // ENOENT en el compilador del App Router.
    //
    // Este plugin garantiza que el directorio pages/ y un fallback mínimo de
    // _document.js existan antes de cada compilación del lado servidor,
    // eliminando la condición de carrera sin tocar la arquitectura antigua.
    if (isServer) {
      const pagesDir = path.resolve(
        config.context ?? process.cwd(),
        '.next',
        'server',
        'pages',
      );
      const documentJs = path.join(pagesDir, '_document.js');

      const ensurePagesDocumentPlugin = {
        apply(compiler: { hooks: { beforeCompile: { tapAsync: (name: string, fn: (_: unknown, cb: () => void) => void) => void } } }) {
          compiler.hooks.beforeCompile.tapAsync(
            'EnsurePagesDocument',
            (_params: unknown, callback: () => void) => {
              try {
                if (!fs.existsSync(pagesDir)) {
                  fs.mkdirSync(pagesDir, { recursive: true });
                }
                if (!fs.existsSync(documentJs)) {
                  fs.writeFileSync(
                    documentJs,
                    'module.exports = require("next/document").default;\n',
                  );
                }
              } catch {
                // Non-fatal: Next.js generará el archivo en la compilación
                // del Pages Router aunque este fallback falle.
              }
              callback();
            },
          );
        },
      };

      config.plugins?.push(ensurePagesDocumentPlugin);
    }

    return config;
  },
};

export default nextConfig;
