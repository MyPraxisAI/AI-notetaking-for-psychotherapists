'use client';

import { createRef, useEffect, useRef } from 'react';

import type { LoadingBarRef } from 'react-top-loading-bar';
import LoadingBar from 'react-top-loading-bar';

export function TopLoadingBarIndicator({
  completeOnUnmount = true,
}: {
  completeOnUnmount?: boolean;
}) {
  const ref = createRef<LoadingBarRef>();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!ref.current || runningRef.current) {
      return;
    }

    const loadingBarRef = ref.current;

    loadingBarRef.continuousStart(0, 250);
    runningRef.current = true;

    return () => {
      if (completeOnUnmount) {
        loadingBarRef.complete();
      }
      runningRef.current = false;
    };
  }, [completeOnUnmount, ref]);

  return (
    <LoadingBar
      className={'bg-primary'}
      height={4}
      waitingTime={0}
      shadow
      color={''}
      ref={ref}
    />
  );
}
