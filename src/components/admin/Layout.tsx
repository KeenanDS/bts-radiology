
import React from 'react';
import Sidebar from './Sidebar';
import { Toaster } from '@/components/ui/toaster';

export interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f1e] text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
        <Toaster />
      </main>
    </div>
  );
};
