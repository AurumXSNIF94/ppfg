import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EntryForm from './pages/EntryForm';
import StockList from './pages/StockList';
import SoList from './pages/SoList'; // 1. Impor komponen SoList

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName] = useState('Admin'); 

  return (
    <div className="flex h-screen bg-bgBody overflow-hidden font-sans text-textMain">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-w-0 bg-bgBody shadow-[inset_5px_0_25px_rgba(0,0,0,0.02)] rounded-tl-3xl rounded-bl-3xl my-2 mr-2 overflow-hidden border border-borderLight">
        
        {/* HEADER */}
        <header className="px-8 py-6 flex justify-between items-center bg-surface border-b border-borderLight z-10">
          <div>
            <h1 className="text-2xl font-extrabold text-textMain tracking-tight">
              Good morning, <span className="text-primary">{userName}</span>
            </h1>
            <p className="text-sm font-semibold text-textMuted mt-1">Today's overview</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full border border-borderLight flex justify-center items-center hover:shadow-soft transition-shadow bg-surface">
              🌙
            </button>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 cursor-pointer">
              <img src={`https://ui-avatars.com/api/?name=${userName}&background=4F46E5&color=fff`} alt="Profile" className="w-full h-full object-cover"/>
            </div>
          </div>
        </header>

        {/* TAB CONTENT AREA */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className={`absolute inset-0 p-8 overflow-y-auto transition-opacity duration-300 ${activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}>
            <Dashboard />
          </div>
          <div className={`absolute inset-0 p-8 overflow-y-auto transition-opacity duration-300 ${activeTab === 'entry' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}>
            <EntryForm />
          </div>
          <div className={`absolute inset-0 p-8 overflow-hidden transition-opacity duration-300 ${activeTab === 'stock' ? 'opacity-100 z-10 flex flex-col' : 'opacity-0 z-0 hidden'}`}>
            <StockList />
          </div>
          {/* 2. Render halaman SO List */}
          <div className={`absolute inset-0 p-8 overflow-hidden transition-opacity duration-300 ${activeTab === 'solist' ? 'opacity-100 z-10 flex flex-col' : 'opacity-0 z-0 hidden'}`}>
            <SoList />
          </div>
        </div>

      </main>
    </div>
  );
}
