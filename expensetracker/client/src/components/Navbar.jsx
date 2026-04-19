import {
  LayoutDashboard,
  ListOrdered,
  Wallet,
  Target,
  User,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

const Sidebar = () => {
  const menu = [
    { label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "All Expenses", icon: <ListOrdered size={20} /> },
    { label: "Goals", icon: <Target size={20} /> },
  ];

  const tools = [
    { label: "Insights", icon: <LayoutDashboard size={20} /> },
    { label: "Analytics", icon: <LayoutDashboard size={20} /> },
  ];

  const others = [
    { label: "Settings", icon: <Settings size={20} /> },
    { label: "Help Center", icon: <HelpCircle size={20} /> },
    { label: "Logout", icon: <LogOut size={20} /> },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-zinc-200 flex flex-col py-6 px-4 shadow-sm">

      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-lg">
          ₹
        </div>
        <h1 className="text-xl font-bold tracking-wide">Spendly</h1>
      </div>

      {/* MENU SECTION */}
      <h2 className="text-xs font-semibold uppercase text-zinc-400 mb-3 px-2">
        General
      </h2>

      <ul className="space-y-2 mb-6">
        {menu.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-all"
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </li>
        ))}
      </ul>

      {/* TOOLS */}
      <h2 className="text-xs font-semibold uppercase text-zinc-400 mb-3 px-2">
        Tools
      </h2>

      <ul className="space-y-2 mb-6">
        {tools.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-all"
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </li>
        ))}
      </ul>

      {/* OTHERS */}
      <h2 className="text-xs font-semibold uppercase text-zinc-400 mb-3 px-2">
        Others
      </h2>

      <ul className="space-y-2">
        {others.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-all"
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
