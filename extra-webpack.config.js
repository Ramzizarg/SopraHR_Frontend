const { PurgeCSSPlugin } = require('purgecss-webpack-plugin');
const glob = require('glob');
const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');
const zlib = require('zlib');

module.exports = {
  plugins: [
    // Remove unused CSS
    new PurgeCSSPlugin({
      paths: glob.sync(`${path.join(__dirname, 'src')}/**/*`, { nodir: true }),
      safelist: {
        standard: [/^mat-/, /^cdk-/, /^ng-/, /^fa-/, /^svg-/, /^swiper-/, /^aos-/],
        deep: [/^bs-/, /^show$/, /^active$/, /^open$/, /^carousel/],
        greedy: [/ng-trigger/, /ripple/, /^selected/, /expanded/]
      }
    }),
    
    // Compress JavaScript and CSS files
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
    
    // Brotli compression (better than gzip)
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      compressionOptions: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        },
      },
      threshold: 10240,
      minRatio: 0.8,
    }),
  ],
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'async',
          priority: 10,
          reuseExistingChunk: true,
          enforce: true,
        },
      },
    },
  },
};
