import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Trophy, Star, Activity, Plus, Target, ClipboardList, Medal, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn, isMatchLocked } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    teamsCount: 0,
    totalPoints: 0,
    rank: '-',
  });
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Get teams count
        const { count: teamsCount } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Get user profile stats
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_points, global_rank')
          .eq('id', user.id)
          .single();

        setStats({
          teamsCount: teamsCount || 0,
          totalPoints: profile?.total_points || 0,
          rank: profile?.global_rank || '-',
        });

        // Get upcoming matches
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'scheduled')
          .order('match_date', { ascending: true })
          .limit(3);

        setUpcomingMatches(matches || []);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="text-center py-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to IPL 2026 Fantasy League</h1>
        <p className="text-gray-500">Your ultimate cricket fantasy experience</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-50 rounded-lg text-blue-600">
            <Users className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.teamsCount}</h3>
            <p className="text-sm text-gray-500 font-medium">Teams Created</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-yellow-50 rounded-lg text-yellow-600">
            <Star className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalPoints}</h3>
            <p className="text-sm text-gray-500 font-medium">Total Points</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-green-50 rounded-lg text-green-600">
            <Activity className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.rank}</h3>
            <p className="text-sm text-gray-500 font-medium">Global Rank</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Matches</h2>
            <Link to="/matches" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
              View All
            </Link>
          </div>
          
          {upcomingMatches.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
              No scheduled matches.
            </div>
          ) : (
            <div className="grid gap-4">
              {upcomingMatches.map((match) => {
                const locked = isMatchLocked(match.match_date, match.match_time);
                
                return (
                <div key={match.id} className={cn("bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 transition-hover hover:shadow-md", locked && "opacity-80")}>
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-center mb-2">
                      <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", locked ? "bg-gray-100 text-gray-700" : "bg-blue-50 text-blue-600")}>
                        Match {match.match_number}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        {locked && <Lock className="h-3 w-3" />}
                        {format(new Date(match.match_date), 'MMM d, yyyy')} • {match.match_time}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-4 py-4">
                      <div className="text-xl font-bold text-gray-900 w-24 text-right">{match.home_team}</div>
                      <div className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">VS</div>
                      <div className="text-xl font-bold text-gray-900 w-24 text-left">{match.away_team}</div>
                    </div>
                    <div className="text-center text-sm text-gray-500">
                      📍 {match.venue}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Link
                      to={locked ? '#' : `/create-team/${match.id}`}
                      onClick={(e) => locked && e.preventDefault()}
                      className={cn("block w-full text-center px-6 py-3 rounded-lg font-medium transition-colors", 
                        locked ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
                      )}
                    >
                      {locked ? 'Match Started' : 'Create Team'}
                    </Link>
                  </div>
                </div>
              )})}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <Link to="/matches" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Create New Team</h3>
                <p className="text-sm text-gray-500">Build your dream team</p>
              </div>
            </Link>
            <Link to="/my-teams" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-green-300 hover:shadow-md transition-all group flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">View Teams</h3>
                <p className="text-sm text-gray-500">Manage your squads</p>
              </div>
            </Link>
            <Link to="/leaderboard" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-yellow-300 hover:shadow-md transition-all group flex items-center gap-4">
              <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg group-hover:bg-yellow-600 group-hover:text-white transition-colors">
                <Medal className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Leaderboard</h3>
                <p className="text-sm text-gray-500">Check rankings</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
