import type { CmsType } from './cms.type';

const CMS_CLIENT = process.env.CMS_CLIENT as CmsType;

interface ContentRendererProps {
  content: unknown;
  type?: CmsType;
}

export async function ContentRenderer({
  content,
  type = CMS_CLIENT,
}: ContentRendererProps) {
  switch (type) {
    case 'keystatic': {
      const { KeystaticDocumentRenderer } = await import(
        '../../keystatic/src/content-renderer'
      );

      return <KeystaticDocumentRenderer content={content} />;
    }

    case 'wordpress': {
      const { WordpressContentRenderer } = await import(
        '../../wordpress/src/content-renderer'
      );

      return <WordpressContentRenderer content={content} />;
    }

    default: {
      console.error(`Unknown CMS client: ${type as string}`);

      return null;
    }
  }
}
