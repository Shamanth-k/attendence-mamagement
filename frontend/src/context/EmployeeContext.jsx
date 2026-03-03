import { createContext, useContext, useMemo, useState } from "react";

const EmployeeContext = createContext(null);

function EmployeeProvider({ children }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const value = {
    employees,
    setEmployees,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedEmployee
  };

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployee must be used inside EmployeeProvider");
  return ctx;
}

export { EmployeeProvider, useEmployee };
