'use client';

import Link from 'next/link';

interface NavItem {
  text: string;
  level: number;
  href: string;
  children: NavItem[];
}

export function DocsTableOfContents(props: { data: NavItem[] }) {
  const navData = props.data;

  return (
    <div className="lg:block hidden sticky bg-background min-w-[14em] border-l p-4 inset-y-0 h-svh max-h-full">
      <ol
        role="list"
        className="relative text-sm text-gray-600 dark:text-gray-400"
      >
        {navData.map((item) => (
          <li key={item.href} className="group/item relative mt-3 first:mt-0">
            <a
              href={item.href}
              className="block transition-colors hover:text-gray-950 dark:hover:text-white [&_*]:[font:inherit]"
            >
              {item.text}
            </a>
            {item.children && (
              <ol role="list" className="relative mt-3 pl-4">
                {item.children.map((child) => (
                  <li
                    key={child.href}
                    className="group/subitem relative mt-3 first:mt-0"
                  >
                    <Link
                      href={child.href}
                      className="block transition-colors hover:text-gray-950 dark:hover:text-white [&_*]:[font:inherit]"
                    >
                      {child.text}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
