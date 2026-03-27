import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Users, Star, Activity } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) throw error;
        setMessage('Account created! Please check your email to verify.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-800 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12 text-white">
        <Trophy className="h-20 w-20 mx-auto mb-6 text-yellow-400" />
        <h1 className="text-5xl font-extrabold tracking-tight mb-4">
          IPL Fantasy League
        </h1>
        <p className="text-xl opacity-90 font-medium">
          Build Your Dream Team for IPL 2026
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
              isLogin
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`flex-1 py-4 text-center font-semibold text-lg transition-colors ${
              !isLogin
                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="p-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            {isLogin ? 'Welcome Back!' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm font-medium">
              {message}
            </div>
          )}

          {!isLogin && (
            <div>
              <input
                type="text"
                required
                placeholder="Full Name"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <input
              type="email"
              required
              placeholder="Email Address"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>

          <p className="text-center text-gray-600 mt-6">
            {isLogin ? "New here? " : "Already registered? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-indigo-600 font-semibold hover:underline"
            >
              {isLogin ? 'Create Account' : 'Login'}
            </button>
          </p>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white text-center">
          <Users className="h-10 w-10 mx-auto mb-4 text-indigo-300" />
          <h3 className="text-lg font-bold mb-2">Build Your Team</h3>
          <p className="opacity-80 text-sm">Select 11 players within 100 credits</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white text-center">
          <Trophy className="h-10 w-10 mx-auto mb-4 text-yellow-300" />
          <h3 className="text-lg font-bold mb-2">Create Leagues</h3>
          <p className="opacity-80 text-sm">Compete with friends</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white text-center">
          <Activity className="h-10 w-10 mx-auto mb-4 text-green-300" />
          <h3 className="text-lg font-bold mb-2">Live Scoring</h3>
          <p className="opacity-80 text-sm">Real-time match updates</p>
        </div>
      </div>
    </div>
  );
}
