// The one Node API vite.config.ts uses, declared here so the project doesn't
// need all of @types/node just to type-check its build config.
declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
