function DateRangeFilterBar({
  period,
  rangeOptions = [],
  labels = {},
  onPeriodChange,
  rangeLabel = "",
  anchorDate,
  onAnchorDateChange,
  anchorLabel = "Date",
  showDateRange = false,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange
}) {
  return (
    <div className="simple-filter-wrap">
      {rangeOptions.length > 0 && (
        <div className="simple-filter-row">
          <label className="simple-filter-label" htmlFor="filter-period">
            View
          </label>
          <select
            id="filter-period"
            className="simple-filter-select"
            value={period}
            onChange={(e) => onPeriodChange?.(e.target.value)}
          >
            {rangeOptions.map((option) => (
              <option key={option} value={option}>
                {labels[option] || option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="date-filter-row simple-filter-row">
        {showDateRange ? (
          <>
            <label>
              From
              <input type="date" value={customFrom} onChange={(e) => onCustomFromChange?.(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={customTo} onChange={(e) => onCustomToChange?.(e.target.value)} />
            </label>
          </>
        ) : (
          <label>
            {anchorLabel}
            <input type="date" value={anchorDate} onChange={(e) => onAnchorDateChange?.(e.target.value)} />
          </label>
        )}
      </div>
      {rangeLabel ? <p className="simple-filter-note">Showing: {rangeLabel}</p> : null}
    </div>
  );
}

export default DateRangeFilterBar;
