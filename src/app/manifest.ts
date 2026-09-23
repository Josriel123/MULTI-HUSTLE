import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/**
 * Lets a phone add the app to its home screen and open it full screen. The
 * icons are the brand mark (public/icons, src/app/icon.svg); the colours are
 * the page background and accent from BRAND, which must equal the tokens in
 * globals.css (src/app/__tests__/contrast.test.ts checks).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND.pageLight,
    theme_color: BRAND.pageLight,
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add money in', url: '/transactions?add=income', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Add money out', url: '/transactions?add=expense', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Log a trip', url: '/mileage', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
