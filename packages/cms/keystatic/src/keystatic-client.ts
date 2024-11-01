import { Cms, CmsClient } from '@kit/cms-types';

import { createKeystaticReader } from './create-reader';
import { PostEntryProps } from './keystatic.config';
import { renderMarkdoc } from './markdoc';

export function createKeystaticClient() {
  return new KeystaticClient();
}

class KeystaticClient implements CmsClient {
  async getContentItems(options: Cms.GetContentItemsOptions) {
    const reader = await createKeystaticReader();

    const collection =
      options.collection as keyof (typeof reader)['collections'];

    if (!reader.collections[collection]) {
      throw new Error(`Collection ${collection} not found`);
    }

    const docs = await reader.collections[collection].all();

    const startOffset = options?.offset ?? 0;
    const endOffset = startOffset + (options?.limit ?? 10);

    const filtered = docs
      .filter((item) => {
        const status = options?.status ?? 'published';

        if (item.entry.status !== status) {
          return false;
        }

        const categoryMatch = options?.categories?.length
          ? options.categories.find((category) =>
              item.entry.categories.includes(category),
            )
          : true;

        if (!categoryMatch) {
          return false;
        }

        if (options.language) {
          if (item.entry.language && item.entry.language !== options.language) {
            return false;
          }
        }

        const tagMatch = options?.tags?.length
          ? options.tags.find((tag) => item.entry.tags.includes(tag))
          : true;

        if (!tagMatch) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const direction = options.sortDirection ?? 'asc';
        const sortBy = options.sortBy ?? 'publishedAt';

        const transform = (value: string | number | undefined | null) => {
          if (typeof value === 'string') {
            return new Date(value).getTime();
          }

          return value ?? 0;
        };

        const left = transform(a.entry[sortBy]);
        const right = transform(b.entry[sortBy]);

        if (direction === 'asc') {
          return left - right;
        }

        return right - left;
      });

    function processItems(items: typeof docs) {
      const result: typeof docs = [...items];

      const indexFiles = items.filter((item) => {
        const parts = item.slug.split('/');

        return (
          parts.length > 1 &&
          parts[parts.length - 1] === parts[parts.length - 2]
        );
      });

      function findParentIndex(pathParts: string[]): string | null {
        // Try each level up from the current path until we find an index file
        for (let i = pathParts.length - 1; i > 0; i--) {
          const currentPath = pathParts.slice(0, i).join('/');

          const possibleParent = indexFiles.find((indexFile) => {
            const indexParts = indexFile.slug.split('/');
            const indexFolderPath = indexParts.slice(0, -1).join('/');

            return indexFolderPath === currentPath;
          });

          if (possibleParent) {
            return possibleParent.slug;
          }
        }
        return null;
      }

      result.forEach((item) => {
        // never override the parent if it's already set in the config
        if (item.entry.parent) {
          return;
        }

        const pathParts = item.slug.split('/');

        // Skip if this is a root level index file (e.g., "authentication/authentication")
        if (pathParts.length === 2 && pathParts[0] === pathParts[1]) {
          item.entry.parent = null;
          return;
        }

        // Check if current item is an index file
        const isIndexFile =
          pathParts[pathParts.length - 1] === pathParts[pathParts.length - 2];

        if (isIndexFile) {
          // For index files, find parent in the level above
          const parentPath = pathParts.slice(0, -2);
          if (parentPath.length > 0) {
            item.entry.parent = findParentIndex(
              parentPath.concat(parentPath[parentPath.length - 1]!),
            );
          } else {
            item.entry.parent = null;
          }
        } else {
          // For regular files, find parent in the current folder
          item.entry.parent = findParentIndex(pathParts);
        }
      });

      return result;
    }

    const itemsWithParents = processItems(filtered);

    const items = await Promise.all(
      itemsWithParents
        .slice(startOffset, endOffset)
        .sort((a, b) => {
          return (a.entry.order ?? 0) - (b.entry.order ?? 0);
        })
        .map((item) => this.mapPost(item)),
    );

    return {
      total: filtered.length,
      items,
    };
  }

  async getContentItemBySlug(params: {
    slug: string;
    collection: string;
    status?: Cms.ContentItemStatus;
  }) {
    const reader = await createKeystaticReader();

    const collection =
      params.collection as keyof (typeof reader)['collections'];

    if (!reader.collections[collection]) {
      throw new Error(`Collection ${collection} not found`);
    }

    const doc = await reader.collections[collection].read(params.slug);
    const status = params.status ?? 'published';

    // verify that the document exists
    if (!doc) {
      return Promise.resolve(undefined);
    }

    // check the document matches the status provided in the params
    if (doc.status !== status) {
      return Promise.resolve(undefined);
    }

    const allPosts = await reader.collections[collection].all();

    const children = allPosts.filter(
      (item) => item.entry.parent === params.slug,
    );

    return this.mapPost({ entry: doc, slug: params.slug }, children);
  }

  async getCategories() {
    return Promise.resolve([]);
  }

  async getTags() {
    return Promise.resolve([]);
  }

  async getTagBySlug() {
    return Promise.resolve(undefined);
  }

  async getCategoryBySlug() {
    return Promise.resolve(undefined);
  }

  private async mapPost<
    Type extends {
      entry: PostEntryProps;
      slug: string;
    },
  >(item: Type, children: Type[] = []): Promise<Cms.ContentItem> {
    const publishedAt = item.entry.publishedAt
      ? new Date(item.entry.publishedAt)
      : new Date();

    const content = await item.entry.content();
    const html = await renderMarkdoc(content.node);

    return {
      id: item.slug,
      title: item.entry.title,
      label: item.entry.label,
      url: item.slug,
      slug: item.slug,
      description: item.entry.description,
      publishedAt: publishedAt.toISOString(),
      content: html as string,
      image: item.entry.image ?? undefined,
      status: item.entry.status,
      categories:
        item.entry.categories.map((item) => {
          return {
            id: item,
            name: item,
            slug: item,
          };
        }) ?? [],
      tags: item.entry.tags.map((item) => {
        return {
          id: item,
          name: item,
          slug: item,
        };
      }),
      parentId: item.entry.parent ?? undefined,
      order: item.entry.order ?? 1,
      children: await Promise.all(
        children.map((child) => this.mapPost(child, [])),
      ),
    };
  }
}
