import { useState, useCallback } from 'react';

export type DataSource = 'mock' | 'github';

export function useDataSource(initialSource: DataSource = 'github') {
  const [dataSource, setDataSource] = useState<DataSource>(initialSource);

  return {
    dataSource,
    setDataSource: useCallback((s: DataSource) => setDataSource(s), []),
    isMock: dataSource === 'mock',
  };
}
