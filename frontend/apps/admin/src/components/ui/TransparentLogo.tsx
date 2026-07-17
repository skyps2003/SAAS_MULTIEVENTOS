import { useEffect, useState } from 'react';
import { removeBackgroundFromSource } from '../../lib/removeImageBackground';

const processedLogoCache = new Map<string, string>();

interface TransparentLogoProps {
  src: string;
  alt: string;
  className?: string;
}

export function TransparentLogo({ src, alt, className = '' }: TransparentLogoProps) {
  const [displaySource, setDisplaySource] = useState(() => processedLogoCache.get(src) || src);

  useEffect(() => {
    let active = true;
    const cached = processedLogoCache.get(src);
    if (cached) {
      setDisplaySource(cached);
      return () => { active = false; };
    }

    setDisplaySource(src);
    removeBackgroundFromSource(src)
      .then((result) => {
        const nextSource = result.removed ? result.processed : src;
        processedLogoCache.set(src, nextSource);
        if (active) setDisplaySource(nextSource);
      })
      .catch(() => {
        processedLogoCache.set(src, src);
      });

    return () => { active = false; };
  }, [src]);

  return <img src={displaySource} alt={alt} className={className} />;
}
