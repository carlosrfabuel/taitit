import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** The row shown in a side panel: highlighted. */
  selectedKey?: string | null;
};

// A click on a button, link or field inside the row is that control's own action, not the row's.
const insideControl = (e: MouseEvent | KeyboardEvent) =>
  e.target !== e.currentTarget &&
  !!(e.target as HTMLElement).closest('button, a, input, select, textarea, label');

export function Table<T>({ columns, rows, rowKey, onRowClick, empty, selectedKey }: Props<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? (e) => !insideControl(e) && onRowClick(row) : undefined}
              // Clickable rows are reachable with Tab and open with Enter or Space.
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !insideControl(e)) {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              aria-selected={selectedKey != null ? rowKey(row) === selectedKey : undefined}
              className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent' : ''} ${
                selectedKey != null && rowKey(row) === selectedKey
                  ? 'bg-selected/60 hover:bg-selected/60'
                  : ''
              }`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
