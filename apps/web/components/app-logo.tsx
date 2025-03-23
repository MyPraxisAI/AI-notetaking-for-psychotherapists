import Link from 'next/link';
import './app-logo.css';

import { cn } from '@kit/ui/utils';

function LogoImage({
  className,
  width = 105,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <svg 
      version="1.0" 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 222.000000 254.000000" 
      preserveAspectRatio="xMidYMid meet" 
      fill="none" 
      className={cn(`h-8 w-auto`, className)}
      width={width}
    >

      
      <g 
        transform="translate(0.000000,254.000000) scale(0.100000,-0.100000)" 
        className="fill-primary dark:fill-white"
        fill="currentColor" 
        stroke="none"
      >
        <path className="sound-path1" d="M1100 2340 c-61 -119 -95 -512 -79 -917 11 -297 50 -514 99 -558 19 -17 21 -17 40 0 27 25 56 121 77 262 23 152 26 803 5 948 -42 276 -90 367 -142 265z" />
        <path className="sound-path2" d="M801 2244 c-26 -33 -46 -100 -69 -224 -25 -140 -24 -675 1 -810 29 -159 62 -240 97 -240 69 0 117 213 127 561 12 413 -47 739 -132 739 -2 0 -13 -12 -24 -26z" />
        <path className="sound-path3" d="M1432 2263 c-7 -3 -20 -19 -28 -36 -93 -178 -111 -834 -32 -1130 36 -137 82 -165 123 -74 55 122 80 350 72 672 -7 292 -33 467 -80 536 -23 34 -34 41 -55 32z" />
        <path className="sound-path4" d="M502 1918 c-94 -117 -133 -952 -66 -1428 26 -187 54 -265 94 -265 20 0 28 9 43 50 57 149 81 448 74 898 -7 411 -29 610 -83 723 -17 35 -43 44 -62 22z" />
        <path className="sound-path5" d="M1696 1900 c-87 -105 -94 -426 -11 -552 79 -119 157 -2 172 228 16 247 -68 433 -161 324z" />
      </g>
    </svg>
  );
}

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string | null;
  className?: string;
  label?: string;
}) {
  if (href === null) {
    return <LogoImage className={className} />;
  }

  return (
    <Link aria-label={label ?? 'Home Page'} href={href ?? '/'}>
      <LogoImage className={className} />
    </Link>
  );
}
