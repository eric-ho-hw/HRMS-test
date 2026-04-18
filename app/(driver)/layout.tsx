import Link from 'next/link'
import { Clock, FileText, DollarSign, Wallet } from 'lucide-react'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900">FourBeans HRMS</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-10">
        <NavItem href="/driver" icon={<Clock size={20} />} label="Clock" />
        <NavItem href="/driver/ot" icon={<FileText size={20} />} label="OT" />
        <NavItem href="/driver/allowances" icon={<Wallet size={20} />} label="Allowances" />
        <NavItem href="/driver/payslip" icon={<DollarSign size={20} />} label="Payslip" />
      </nav>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 text-gray-500 hover:text-blue-600 px-4 py-1">
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  )
}
