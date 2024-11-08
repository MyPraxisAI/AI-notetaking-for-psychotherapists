import { Cms } from '@kit/cms';
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSub,
} from '@kit/ui/shadcn-sidebar';

import { DocsNavLink } from '~/(marketing)/docs/_components/docs-nav-link';

import { FloatingDocumentationNavigation } from './floating-docs-navigation';

function Node({ node, level }: { node: Cms.ContentItem; level: number }) {
  const pathPrefix = `/docs`;
  const url = `${pathPrefix}/${node.slug}`;

  return (
    <>
      <DocsNavLink label={node.title} url={url} />

      {(node.children ?? []).length > 0 && (
        <Tree pages={node.children ?? []} level={level + 1} />
      )}
    </>
  );
}

function Tree({ pages, level }: { pages: Cms.ContentItem[]; level: number }) {
  if (level === 0) {
    return pages.map((treeNode, index) => (
      <SidebarGroup key={index}>
        <SidebarGroupContent>
          <SidebarMenu>
            <Node key={index} node={treeNode} level={level} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    ));
  }

  return (
    <SidebarMenuSub>
      {pages.map((treeNode, index) => (
        <Node key={index} node={treeNode} level={level} />
      ))}
    </SidebarMenuSub>
  );
}

export function DocsNavigation({ pages }: { pages: Cms.ContentItem[] }) {
  return (
    <>
      <Sidebar
        variant={'ghost'}
        className={'z-1 sticky max-h-full overflow-y-auto'}
      >
        <Tree pages={pages} level={0} />
      </Sidebar>

      <div className={'lg:hidden'}>
        <FloatingDocumentationNavigation>
          <Tree pages={pages} level={0} />
        </FloatingDocumentationNavigation>
      </div>
    </>
  );
}
