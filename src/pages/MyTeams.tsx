import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Users, Trash2, Eye, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MyTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            matches (
              match_number,
              home_team,
              away_team,
              match_date
            )
          `)
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTeams(data || []);
      } catch (error) {
        console.error('Error loading teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [user]);

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${teamName}"?`)) return;

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
      setTeams(teams.filter((t) => t.id !== teamId));
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team');
    }
  };

  const viewTeamDetails = async (teamId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const { data, error } = await supabase
        .from('team_players')
        .select(`
          *,
          players (*)
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      // Fetch player performance for this match
      const { data: perfData, error: perfError } = await supabase
        .from('player_performance')
        .select('*')
        .eq('match_id', team.match_id);

      if (perfError) throw perfError;

      const playersWithPoints = data?.map(tp => {
        const perf = perfData?.find(p => p.player_id === tp.player_id);
        const basePoints = perf ? perf.points_earned : 0;
        const multiplier = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
        return {
          ...tp,
          points_earned: basePoints * multiplier
        };
      });
      
      setSelectedTeam({ ...team, players: playersWithPoints });
    } catch (error) {
      console.error('Error loading team details:', error);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading teams...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Teams</h1>
          <p className="text-gray-500 mt-1">Manage your fantasy squads</p>
        </div>
        <Link
          to="/matches"
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Create New Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            You haven't created any fantasy teams yet. Browse upcoming matches to build your first squad.
          </p>
          <Link
            to="/matches"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Browse Matches
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{team.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Match {team.matches?.match_number}: {team.matches?.home_team} vs {team.matches?.away_team}
                    </p>
                  </div>
                  <div className="bg-green-50 text-green-700 font-black text-xl px-3 py-1 rounded-lg border border-green-100">
                    {team.total_points || 0}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Credits Used:</span>
                  </div>
                  <div className="font-bold text-gray-900">{team.total_credits}/100</div>
                </div>
              </div>
              
              <div className="flex p-3 gap-3 bg-gray-50">
                <button
                  onClick={() => viewTeamDetails(team.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                <button
                  onClick={() => handleDelete(team.id, team.name)}
                  className="flex items-center justify-center p-2 bg-white border border-gray-200 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  title="Delete Team"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTeam(null)}>
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Match {selectedTeam.matches?.match_number}: {selectedTeam.matches?.home_team} vs {selectedTeam.matches?.away_team}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTeam(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Points</div>
                  <div className="text-2xl font-black text-gray-900">{selectedTeam.total_points || 0}</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Credits Used</div>
                  <div className="text-2xl font-black text-gray-900">{selectedTeam.total_credits}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 col-span-2 sm:col-span-1">
                  <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Players</div>
                  <div className="text-2xl font-black text-gray-900">{selectedTeam.players?.length || 0}/11</div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-4">Squad</h3>
              <div className="space-y-3">
                {selectedTeam.players?.map((tp: any) => (
                  <div key={tp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-white',
                        tp.is_captain ? 'bg-blue-600' : tp.is_vice_captain ? 'bg-purple-600' : 'bg-gray-400'
                      )}>
                        {tp.players.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {tp.players.name}
                          {tp.is_captain && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-black">C</span>}
                          {tp.is_vice_captain && <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-black">VC</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {tp.players.team} • {tp.players.role}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{tp.points_earned || 0} pts</div>
                      <div className="text-xs text-gray-400 font-medium">{tp.players.credits} Cr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
