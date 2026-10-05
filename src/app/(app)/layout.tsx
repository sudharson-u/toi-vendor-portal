import Sidebar from '@/components/layout/Sidebar';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'inherit' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="pt-16 lg:pt-6 px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
      <PwaInstallPrompt />
    </div>
  );
}
