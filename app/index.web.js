// Web: Skia draws with CanvasKit (WebAssembly), which must be loaded before any module that imports
// Skia is evaluated (Skia.web reads global.CanvasKit on import), so the app is required only after it.
// canvaskit.wasm is served from the site root (public/canvaskit.wasm, copied by `npm run setup:web`).
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(
  () => {
    require('expo-router/entry');
  },
  () => {
    // Without CanvasKit the app can't run (a very old browser, or the file didn't load): say so
    // instead of leaving a blank page. Plain DOM, the app's colors (shared tokens).
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'font-family:system-ui,sans-serif;color:#141414;background:#F7F6F2;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;line-height:1.5';
    box.innerHTML =
      '<h1 style="font-size:22px;margin:0 0 8px">TAITIT couldn’t start</h1>' +
      '<p style="margin:0 0 16px;color:#5E5E5A">Check your connection and reload the page. ' +
      'If it still doesn’t open, update your browser (Chrome or Safari).</p>' +
      '<button style="font:inherit;padding:10px 20px;border-radius:999px;border:0;background:#141414;color:#fff;cursor:pointer">Reload</button>';
    box.querySelector('button').addEventListener('click', () => location.reload());
    document.body.style.background = '#F7F6F2';
    (document.getElementById('root') ?? document.body).replaceChildren(box);
  },
);
