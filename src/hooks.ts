import { useEffect, useState } from 'react';

/** Carga asíncrona con dependencias; devuelve undefined mientras carga (o si load es null). */
export function useLoad<T>(load: (() => Promise<T>) | null, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    setValue(undefined);
    if (!load) return;
    let alive = true;
    load().then((v) => { if (alive) setValue(v); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
