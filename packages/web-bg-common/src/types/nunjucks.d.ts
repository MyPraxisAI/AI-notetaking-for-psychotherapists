declare module 'nunjucks' {
  export interface LoaderOptions {
    watch?: boolean;
    noCache?: boolean;
  }

  export interface EnvironmentOptions {
    autoescape?: boolean;
    throwOnUndefined?: boolean;
    trimBlocks?: boolean;
    lstripBlocks?: boolean;
  }

  export type Loader = FileSystemLoader | WebLoader | PrecompiledLoader;

  export class FileSystemLoader {
    constructor(searchPaths?: string | string[], opts?: LoaderOptions);
  }

  export class WebLoader {
    constructor(baseUrl?: string, opts?: LoaderOptions);
  }

  export class PrecompiledLoader {
    constructor(searchPaths?: string | string[], opts?: LoaderOptions);
  }

  export class Environment {
    constructor(loader?: Loader | null, opts?: EnvironmentOptions);
    renderString(str: string, context?: Record<string, unknown>): string;
  }
}
