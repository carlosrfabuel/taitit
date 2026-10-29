// Web: Skia draws with CanvasKit (WebAssembly), which must be loaded before any module that imports
// Skia is evaluated (Skia.web reads global.CanvasKit on import), so the app is required only after it.
// canvaskit.wasm is served from the site root (public/canvaskit.wasm, copied by `npm run setup:web`).
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
