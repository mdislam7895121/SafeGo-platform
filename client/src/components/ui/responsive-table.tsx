import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  mobileHidden?: boolean;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  mobileCardRender?: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  mobileCardRender,
  emptyMessage = "No data available",
  className,
}: ResponsiveTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getCellValue = (item: T, column: Column<T>): React.ReactNode => {
    if (column.render) {
      return column.render(item);
    }
    const value = item[column.key as keyof T];
    return value !== undefined && value !== null ? String(value) : "-";
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const visibleColumns = columns.filter((col) => !col.mobileHidden);
  const hiddenColumns = columns.filter((col) => col.mobileHidden);

  return (
    <div className={cn("w-full", className)}>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={cn("px-4 py-3 text-sm", column.className)}
                  >
                    {getCellValue(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {data.map((item, index) => {
          const rowKey = keyExtractor(item);
          const isExpanded = expandedRows.has(rowKey);

          if (mobileCardRender) {
            return (
              <div key={rowKey} onClick={() => onRowClick?.(item)}>
                {mobileCardRender(item, index)}
              </div>
            );
          }

          return (
            <Card
              key={rowKey}
              className={cn(
                "transition-all",
                onRowClick && "cursor-pointer active:bg-muted/50"
              )}
              onClick={() => onRowClick?.(item)}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  {visibleColumns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="flex items-start justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
                        {column.mobileLabel || column.header}
                      </span>
                      <span className="text-sm text-right flex-1">
                        {getCellValue(item, column)}
                      </span>
                    </div>
                  ))}
                </div>

                {hiddenColumns.length > 0 && (
                  <>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {hiddenColumns.map((column) => (
                          <div
                            key={String(column.key)}
                            className="flex items-start justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
                              {column.mobileLabel || column.header}
                            </span>
                            <span className="text-sm text-right flex-1">
                              {getCellValue(item, column)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(rowKey);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Show More ({hiddenColumns.length} fields)
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface MobileDataCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  metrics?: Array<{ label: string; value: React.ReactNode }>;
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileDataCard({
  title,
  subtitle,
  status,
  metrics,
  actions,
  onClick,
  className,
}: MobileDataCardProps) {
  return (
    <Card
      className={cn(
        "transition-all",
        onClick && "cursor-pointer active:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{title}</div>
            {subtitle && (
              <div className="text-sm text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          {status && <div className="shrink-0">{status}</div>}
        </div>

        {metrics && metrics.length > 0 && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
            {metrics.map((metric, idx) => (
              <div key={idx}>
                <div className="text-xs text-muted-foreground">{metric.label}</div>
                <div className="text-sm font-medium">{metric.value}</div>
              </div>
            ))}
          </div>
        )}

        {actions && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">{actions}</div>
        )}
      </CardContent>
    </Card>
  );
}
