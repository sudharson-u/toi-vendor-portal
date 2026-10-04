import Sidebar from '@/components/layout/Sidebar';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="pt-14 lg:pt-0">
          {children}
        </div>
      </main>
      <PwaInstallPrompt />
    </div>
  );
}
