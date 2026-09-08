// Vite supplies the deployment prefix; the DOS module also runs directly in Node.
const baseUrl = import.meta.env?.BASE_URL || '/';

export function assetUrl(path) {
  return `${baseUrl}assets/${path}`;
}
