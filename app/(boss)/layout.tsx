import Link from 'next/link'
import { Users, CheckSquare, DollarSign, UserCog, Settings } from 'lucide-react'

export default function BossLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r min-h-screen">
        <div className="px-5 py-5 border-b">
          <span className="font-bold text-gray-900">FourBeans HRMS</span>
          <p className="text-xs text-gray-400 mt-0.5">Boss Dashboard</p>
        </div>
        <nav className="flex flex-col p-3 gap-1">
          <SideLink href="/boss" icon={<Users size={16} />} label="Attendance" />
          <SideLink href="/boss/approvals" icon={<CheckSquare size={16} />} label="Approvals" />
          <SideLink href="/boss/payroll" icon={<DollarSign size={16} />} label="Payroll" />
          <SideLink href="/boss/drivers" icon={<UserCog size={16} />} label="Drivers" />
          <SideLink href="/boss/settings" icon={<Settings size={16} />} label="Settings" />
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden bg-white border-b px-4 py-3">
          <span className="font-bold text-gray-900">FourBeans HRMS</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-10">
        <MobileLink href="/boss" icon={<Users size={20} />} label="Staff" />
        <MobileLink href="/boss/approvals" icon={<CheckSquare size={20} />} label="Approvals" />
        <MobileLink href="/boss/payroll" icon={<DollarSign size={20} />} label="Payroll" />
        <MobileLink href="/boss/drivers" icon={<UserCog size={20} />} label="Drivers" />
        <MobileLink href="/boss/settings" icon={<Settings size={20} />} label="Settings" />
      </nav>
    </div>
  )
}

function SideLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-700">
      {icon}{label}
    </Link>
  )
}

function MobileLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 text-gray-500 hover:text-blue-600 px-3 py-1">
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  )
}
