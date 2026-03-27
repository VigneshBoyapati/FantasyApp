import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Medal, Users, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Leaderboard() {
  const [searchParams] = useSearchParams();
  const initialMatchId = searchParams.get('match');
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'global' | 'match'>('global');
  const [globalRankings, setGlobalRankings] = useState<any[]>([]);
  const [matchRankings, setMatchRankings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>(initialMatchId || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialMatchId) {
      setActiveTab('match');
      setSelectedMatch(initialMatchId);
    }
  }, [initialMatchId]);

  useEffect(() => {
    const loadMatches = async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_date, match_number')
        .order('match_date', { ascending: false });
      
      if (data) {
        setMatches(data);
        if (!selectedMatch && data.length > 0) {
          setSelectedMatch(data[0].id);
        }
      }
    };
    loadMatches();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'global') {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, full_name, total_points, global_rank')
            .order('total_points', { ascending: false })
            .limit(100);

          if (error) throw error;
          setGlobalRankings(data || []);
        } else if (activeTab === 'match' && selectedMatch) {
          const { data, error } = await supabase
            .from('teams')
            .select(`
              id,
              name,
              total_points,
              total_credits,
              user_id,
              profiles!teams_user_id_fkey(username, full_name)
            `)
            .eq('match_id', selectedMatch)
            .order('total_points', { ascending: false })
            .limit(100);

          if (error) throw error;
          setMatchRankings(data || []);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up realtime subscription
    const channel = supabase.channel('leaderboard_changes');
    
    if (activeTab === 'global') {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadData()
      );
    } else {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        () => loadData()
      );
    }
    
    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [activeTab, selectedMatch]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-gray-500 mt-1">See how you stack up against the competition</p>
        </div>
        
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setActiveTab('global')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'global'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            Global Rankings
          </button>
          <button
            onClick={() => setActiveTab('match')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'match'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            Match Rankings
          </button>
        </div>
      </div>

      {activeTab === 'match' && matches.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
          <label className="font-medium text-gray-700 whitespace-nowrap">Select Match:</label>
          <div className="relative flex-1 max-w-md">
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            >
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  Match {match.match_number}: {match.home_team} vs {match.away_team} - {format(new Date(match.match_date), 'MMM d')}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading rankings...</div>
        ) : (activeTab === 'global' ? globalRankings.length === 0 : matchRankings.length === 0) ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No rankings found</h3>
            <p className="text-gray-500 mt-1">
              Check back later when more matches have been played.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                  {activeTab === 'match' && (
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Team Name</th>
                  )}
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Points</th>
                  {activeTab === 'match' && (
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Credits Used</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(activeTab === 'global' ? globalRankings : matchRankings).map((item, index) => {
                  const isCurrentUser = item.user_id === user?.id || item.id === user?.id;
                  const rank = activeTab === 'global' ? (item.global_rank || index + 1) : index + 1;
                  
                  return (
                    <tr 
                      key={item.id} 
                      className={cn(
                        "transition-colors hover:bg-gray-50",
                        isCurrentUser ? "bg-blue-50/50" : ""
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {rank <= 3 ? (
                            <div className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full font-bold",
                              rank === 1 ? "bg-yellow-100 text-yellow-700" :
                              rank === 2 ? "bg-gray-200 text-gray-700" :
                              "bg-orange-100 text-orange-700"
                            )}>
                              {rank}
                            </div>
                          ) : (
                            <span className="text-gray-500 font-medium w-8 text-center">{rank}</span>
                          )}
                        </div>
                      </td>
                      {activeTab === 'match' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900">{item.name}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">
                            {activeTab === 'global' 
                              ? (item.username || item.full_name || 'Anonymous User')
                              : (item.profiles?.username || item.profiles?.full_name || 'Anonymous User')}
                          </div>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-bold text-gray-900 text-lg">{item.total_points || 0}</span>
                      </td>
                      {activeTab === 'match' && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-gray-500 font-medium">{item.total_credits || 0}</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
