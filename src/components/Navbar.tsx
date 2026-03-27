import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const links = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Matches', path: '/matches' },
    { name: 'My Teams', path: '/my-teams' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'Admin', path: '/admin' },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold">
              <Trophy className="h-6 w-6 text-yellow-400" />
              IPL Fantasy
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === link.path
                    ? 'bg-white/20 border-b-2 border-white'
                    : 'hover:bg-white/10'
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/20">
              <span className="text-sm font-medium truncate max-w-[150px]">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-white/30 hover:bg-white/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-white/10 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-blue-800 pb-4">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'block px-3 py-2 rounded-md text-base font-medium',
                  location.pathname === link.path
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-white/20 px-3">
              <div className="text-sm font-medium mb-3 truncate">
                {user.email}
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-medium border border-white/30 hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
