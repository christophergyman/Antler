import { useState, useCallback } from "react";

type DataSource = "mock" | "github";

export function useDataSource() {
  const [dataSource, setDataSourceState] = useState<DataSource>("github");

  const setDataSource = useCallback((source: DataSource) => {
    setDataSourceState(source);
  }, []);

  return {
    dataSource,
    setDataSource,
    isMock: dataSource === "mock",
  };
}
