import { cache } from 'react';

import { notFound } from 'next/navigation';

import { ContentRenderer, createCmsClient } from '@kit/cms';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';
import { cn } from '@kit/ui/utils';

import { withI18n } from '~/lib/i18n/with-i18n';

// styles
import styles from '../../blog/_components/html-renderer.module.css';
// local imports
import { DocsCards } from '../_components/docs-cards';
import { DocsTableOfContents } from '../_components/docs-table-of-contents';
import { extractHeadingsFromJSX } from '../_lib/utils';

const getPageBySlug = cache(pageLoader);

interface DocumentationPageProps {
  params: Promise<{ slug: string[] }>;
}

async function pageLoader(slug: string) {
  const client = await createCmsClient();

  return client.getContentItemBySlug({ slug, collection: 'documentation' });
}

export const generateMetadata = async ({ params }: DocumentationPageProps) => {
  const slug = (await params).slug.join('/');
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const { title, description } = page;

  return {
    title,
    description,
  };
};

async function DocumentationPage({ params }: DocumentationPageProps) {
  const slug = (await params).slug.join('/');
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const description = page?.description ?? '';

  const headings = extractHeadingsFromJSX(
    page.content as {
      props: { children: React.ReactElement[] };
    },
  );

  return (
    <div className={'flex flex-1 flex-col space-y-4'}>
      <div className={'flex'}>
        <article className={cn(styles.HTML, 'container space-y-12')}>
          <section className={'flex flex-col space-y-4 pt-6'}>
            <h1 className={'!my-0'}>{page.title}</h1>

            <h2 className={'!mb-0 !font-normal text-muted-foreground'}>
              {description}
            </h2>
          </section>

          <ContentRenderer content={page.content} />
        </article>

        <DocsTableOfContents data={headings} />
      </div>

      <If condition={page.children.length > 0}>
        <Separator />

        <DocsCards cards={page.children ?? []} />
      </If>
    </div>
  );
}

export default withI18n(DocumentationPage);
