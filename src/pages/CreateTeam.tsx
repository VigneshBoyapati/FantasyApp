import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { Search, Info, AlertCircle, CheckCircle2, ChevronRight, Users, Shield, Zap, Target, Lock } from 'lucide-react';
import { isMatchLocked } from '../lib/utils';

const MAX_PLAYERS = 11;
const MAX_CREDITS = 100;

const ROLE_REQUIREMENTS = {
  WK: { min: 1, max: 4, label: 'Wicket Keeper' },
  BAT: { min: 3, max: 6, label: 'Batsman' },
  AR: { min: 0, max: 4, label: 'All-Rounder' },
  BOWL: { min: 3, max: 6, label: 'Bowler' },
};

export default function CreateTeam() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!matchId) throw new Error('Match ID required');

        // Load match
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (matchError) throw matchError;
        if (!matchData) throw new Error('Match not found');
        
        const locked = isMatchLocked(matchData.match_date, matchData.match_time);
        setIsLocked(locked);
        
        if (matchData.status === 'completed' || locked) {
          // If match is locked, we still show the UI but with a locked state, or redirect.
          // Let's just keep it here and show a locked screen below.
        }

        setMatch(matchData);

        // Load players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .or(`team.eq.${matchData.home_team},team.eq.${matchData.away_team}`)
          .order('credits', { ascending: false });

        if (playersError) throw playersError;
        setPlayers(playersData || []);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [matchId, navigate]);

  const creditsUsed = selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
  const creditsRemaining = MAX_CREDITS - creditsUsed;

  const roleCounts = selectedPlayers.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const togglePlayer = (player: any) => {
    const isSelected = selectedPlayers.some((p) => p.id === player.id);

    if (isSelected) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
    } else {
      if (selectedPlayers.length >= MAX_PLAYERS) {
        setError(`You can only select ${MAX_PLAYERS} players`);
        setTimeout(() => setError(''), 3000);
        return;
      }

      if (creditsRemaining < player.credits) {
        setError('Not enough credits!');
        setTimeout(() => setError(''), 3000);
        return;
      }

      const currentRoleCount = roleCounts[player.role] || 0;
      const roleReq = ROLE_REQUIREMENTS[player.role as keyof typeof ROLE_REQUIREMENTS];
      
      if (currentRoleCount >= roleReq.max) {
        setError(`Maximum ${roleReq.max} ${roleReq.label}s allowed`);
        setTimeout(() => setError(''), 3000);
        return;
      }

      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const handleSave = async () => {
    if (isLocked) {
      setError('This match has already started. You can no longer create or edit teams.');
      return;
    }
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    if (selectedPlayers.length !== MAX_PLAYERS) {
      setError(`Please select exactly ${MAX_PLAYERS} players`);
      return;
    }
    if (!captainId || !viceCaptainId) {
      setError('Please select captain and vice-captain');
      return;
    }

    // Validate minimum role requirements
    for (const [role, req] of Object.entries(ROLE_REQUIREMENTS)) {
      const count = roleCounts[role] || 0;
      if (count < req.min) {
        setError(`Minimum ${req.min} ${req.label}(s) required`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName,
          user_id: user!.id,
          match_id: match.id,
          total_credits: creditsUsed,
          total_points: 0,
          captain_id: captainId,
          vice_captain_id: viceCaptainId,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add players
      const teamPlayers = selectedPlayers.map((p) => ({
        team_id: team.id,
        player_id: p.id,
        is_captain: p.id === captainId,
        is_vice_captain: p.id === viceCaptainId,
      }));

      const { error: playersError } = await supabase
        .from('team_players')
        .insert(teamPlayers);

      if (playersError) throw playersError;

      // Auto-join league
      let { data: league } = await supabase
        .from('leagues')
        .select('id')
        .eq('match_id', matchId)
        .single();

      if (!league) {
        // Create default league if it doesn't exist
        const { data: newLeague } = await supabase
          .from('leagues')
          .insert({
            name: `${match.home_team} vs ${match.away_team} Global League`,
            match_id: matchId,
            created_by: user!.id,
          })
          .select()
          .single();
        league = newLeague;
      }

      if (league) {
        // Check if already a member
        const { data: existingMember } = await supabase
          .from('league_members')
          .select('id')
          .eq('league_id', league.id)
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!existingMember) {
          await supabase
            .from('league_members')
            .insert({
              league_id: league.id,
              user_id: user!.id,
            });
        }
      }

      alert('Team created successfully and joined the match league!');
      navigate(`/leaderboard?match=${matchId}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const filteredPlayers = players.filter((p) => {
    const matchesRole = filterRole === 'all' || p.role === filterRole;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (!match) return <div className="text-center text-red-500">Match not found</div>;

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center">
        <Lock className="h-16 w-16 mx-auto text-gray-400 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Match Locked</h2>
        <p className="text-gray-500 mb-8">
          This match has already started or completed. You can no longer create or edit teams for this match.
        </p>
        <button
          onClick={() => navigate('/matches')}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
        >
          Browse Other Matches
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Panel: Player Selection */}
      <div className="flex-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Players</h2>
              <p className="text-sm text-gray-500 mt-1">
                {match.home_team} vs {match.away_team}
              </p>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
              {['all', 'WK', 'BAT', 'AR', 'BOWL'].map((role) => (
                <button
                  key={role}
                  onClick={() => setFilterRole(role)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                    filterRole === role
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {role === 'all' ? 'All' : role}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredPlayers.map((player) => {
              const isSelected = selectedPlayers.some((p) => p.id === player.id);
              
              return (
                <div
                  key={player.id}
                  onClick={() => togglePlayer(player)}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all',
                    isSelected
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    )}>
                      {player.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{player.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">{player.team}</span>
                        <span>•</span>
                        <span>{player.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-black text-lg text-blue-600">{player.credits}</div>
                      <div className="text-xs text-gray-400 font-medium">Credits</div>
                    </div>
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    )}>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredPlayers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No players found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Selected Team */}
      <div className="w-full lg:w-[400px] space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-24">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Team</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="text-sm text-gray-500 font-medium mb-1">Players</div>
              <div className="text-2xl font-black text-gray-900">
                <span className={selectedPlayers.length === MAX_PLAYERS ? 'text-green-600' : ''}>
                  {selectedPlayers.length}
                </span>
                <span className="text-gray-400 text-lg">/11</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="text-sm text-gray-500 font-medium mb-1">Credits Left</div>
              <div className="text-2xl font-black text-gray-900">
                <span className={creditsRemaining < 0 ? 'text-red-600' : 'text-blue-600'}>
                  {creditsRemaining.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Role Requirements</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROLE_REQUIREMENTS).map(([role, req]) => {
                const count = roleCounts[role] || 0;
                const isValid = count >= req.min && count <= req.max;
                
                return (
                  <div key={role} className={cn(
                    'flex justify-between items-center p-2 rounded-lg text-xs font-medium border',
                    isValid ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                  )}>
                    <span>{role}</span>
                    <span>{count} / {req.min}-{req.max}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedPlayers.length > 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Selected Squad</h3>
                {selectedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{player.name}</div>
                      <div className="text-xs text-gray-500">{player.role} • {player.credits} Cr</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (viceCaptainId === player.id) setViceCaptainId(null);
                          setCaptainId(captainId === player.id ? null : player.id);
                        }}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                          captainId === player.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300'
                        )}
                        title="Captain (2x points)"
                      >
                        C
                      </button>
                      <button
                        onClick={() => {
                          if (captainId === player.id) setCaptainId(null);
                          setViceCaptainId(viceCaptainId === player.id ? null : player.id);
                        }}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                          viceCaptainId === player.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-purple-300'
                        )}
                        title="Vice Captain (1.5x points)"
                      >
                        VC
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedPlayers.length === MAX_PLAYERS && (
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">Team Name</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Mumbai Masters"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  
                  <button
                    onClick={handleSave}
                    disabled={saving || !teamName || !captainId || !viceCaptainId}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving Team...' : 'Save & Join League'}
                    {!saving && <ChevronRight className="h-5 w-5" />}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Select players from the left panel to build your team.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
