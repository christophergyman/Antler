import { useState, useCallback } from 'react';
import { logUserAction } from '@services/logging';

export type DataSource = 'mock' | 'github';

export function useDataSource(initialSource: DataSource = 'github') {
  const [dataSource, setDataSource] = useState<DataSource>(initialSource);

  const setDataSourceWithLogging = useCallback((newSource: DataSource) => {
    logUserAction('data_source_toggle', `Data source changed to ${newSource}`, {
      from: dataSource,
      to: newSource,
    });
    setDataSource(newSource);
  }, [dataSource]);

  return {
    dataSource,
    setDataSource: setDataSourceWithLogging,
    isMock: dataSource === 'mock',
  };
}
