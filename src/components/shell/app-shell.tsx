import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return <main className="appShell">{children}</main>;
}
