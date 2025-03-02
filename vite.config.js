export default {
  base: './',
  publicDir: 'public',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: '/index.html'
      }
    }
  }
} 