declare module 'nunjucks' {
  export class Environment {
    constructor(loader: any, opts?: any);
    renderString(str: string, context: any): string;
  }
}
