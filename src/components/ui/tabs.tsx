import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within a Tabs provider');
  return context;
}

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('flex flex-col h-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: selectedValue, onValueChange } = useTabs();
  const isActive = selectedValue === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 -mb-px'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: selectedValue } = useTabs();
  if (selectedValue !== value) return null;
  return <div className={cn('flex-1 min-h-0', className)}>{children}</div>;
}
