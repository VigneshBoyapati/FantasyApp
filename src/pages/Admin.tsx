import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Admin() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [winner, setWinner] = useState('');
  const [motm, setMotm] = useState('');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSelect = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    setSelectedMatch(match);
    setWinner('');
    setMotm('');

    if (match) {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .or(`team.eq.${match.home_team},team.eq.${match.away_team}`)
          .order('name');

        if (error) throw error;
        setPlayers(data || []);
      } catch (error) {
        console.error('Error loading players:', error);
      }
    } else {
      setPlayers([]);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch || !winner || !motm) {
      setMessage({ type: 'error', text: 'Please fill all fields' });
      return;
    }

    setSimulating(true);
    setMessage({ type: '', text: '' });

    try {
      // Update match status
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          winner_team: winner,
        })
        .eq('id', selectedMatch.id);

      if (matchError) throw matchError;

      // Generate points for all players in this match
      for (const player of players) {
        let points = 0;

        if (player.role === 'BAT') points = Math.floor(Math.random() * 50) + 10;
        else if (player.role === 'BOWL') points = Math.floor(Math.random() * 40) + 15;
        else if (player.role === 'AR') points = Math.floor(Math.random() * 60) + 20;
        else if (player.role === 'WK') points = Math.floor(Math.random() * 45) + 10;

        if (player.id === motm) points += 25;
        if (player.team === winner) points += 10;

        // Insert into player_performance
        const { error: perfError } = await supabase
          .from('player_performance')
          .upsert({
            player_id: player.id,
            match_id: selectedMatch.id,
            points_earned: points,
            is_man_of_match: player.id === motm
          }, { onConflict: 'player_id,match_id' });
          
        if (perfError) console.error('Error updating player performance:', perfError);
      }

      // Update team points
      await updateAllTeamPoints();

      setMessage({ type: 'success', text: 'Match simulated successfully! Points calculated.' });
      setSelectedMatch(null);
      setWinner('');
      setMotm('');
      loadMatches();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSimulating(false);
    }
  };

  const updateAllTeamPoints = async () => {
    try {
      const { data: teams, error: teamsError } = await supabase.from('teams').select('id, match_id');
      if (teamsError) throw teamsError;

      for (const team of teams || []) {
        const { data: teamPlayers, error: tpError } = await supabase
          .from('team_players')
          .select('player_id, is_captain, is_vice_captain')
          .eq('team_id', team.id);

        if (tpError) continue;

        let totalPoints = 0;
        for (const tp of teamPlayers || []) {
          const { data: perf } = await supabase
            .from('player_performance')
            .select('points_earned')
            .eq('player_id', tp.player_id)
            .eq('match_id', team.match_id)
            .maybeSingle();
            
          const pts = perf ? perf.points_earned : 0;
          const multiplier = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
          totalPoints += pts * multiplier;
        }

        await supabase
          .from('teams')
          .update({ total_points: Math.round(totalPoints) })
          .eq('id', team.id);
      }

      // Update profiles total_points
      const { data: allTeams } = await supabase.from('teams').select('user_id, total_points');
      const userPoints: Record<string, number> = {};
      for (const t of allTeams || []) {
        userPoints[t.user_id] = (userPoints[t.user_id] || 0) + (t.total_points || 0);
      }

      // Update profiles
      for (const [userId, points] of Object.entries(userPoints)) {
        await supabase
          .from('profiles')
          .update({ total_points: points })
          .eq('id', userId);
      }
      
      // Update global ranks
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, total_points')
        .order('total_points', { ascending: false });
        
      if (profiles) {
        for (let i = 0; i < profiles.length; i++) {
          await supabase
            .from('profiles')
            .update({ global_rank: i + 1 })
            .eq('id', profiles[i].id);
        }
      }
    } catch (error) {
      console.error('Error updating team points:', error);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('This will reset ALL points and mark ALL matches as scheduled. Continue?')) return;

    try {
      setSimulating(true);
      await supabase.from('teams').update({ total_points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('player_performance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('profiles').update({ total_points: 0, global_rank: null }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('matches').update({ status: 'scheduled', winner_team: null }).neq('id', '00000000-0000-0000-0000-000000000000');
      
      setMessage({ type: 'success', text: 'All points reset!' });
      loadMatches();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading admin panel...</div>;

  const scheduledMatches = matches.filter((m) => m.status === 'scheduled');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-gray-600" />
            Match Simulator
          </h1>
          <p className="text-gray-500 mt-1">Simulate match results and update player points for testing</p>
        </div>
      </div>

      {message.text && (
        <div className={cn(
          'p-4 rounded-xl text-sm font-medium border flex items-start gap-3',
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
        )}>
          <div className={cn('mt-0.5', message.type === 'error' ? 'text-red-500' : 'text-green-500')}>
            {message.type === 'error' ? <AlertTriangle className="h-5 w-5" /> : '✓'}
          </div>
          <p>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Simulate Match Result</h2>
          <form onSubmit={handleSimulate} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Select Match</label>
              <select
                value={selectedMatch?.id || ''}
                onChange={(e) => handleMatchSelect(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
              >
                <option value="">Select a match</option>
                {scheduledMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.home_team} vs {match.away_team} - {new Date(match.match_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedMatch && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Winner</label>
                  <select
                    value={winner}
                    onChange={(e) => setWinner(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                  >
                    <option value="">Select winner</option>
                    <option value={selectedMatch.home_team}>{selectedMatch.home_team}</option>
                    <option value={selectedMatch.away_team}>{selectedMatch.away_team}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Man of the Match</label>
                  <select
                    value={motm}
                    onChange={(e) => setMotm(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                  >
                    <option value="">Select player</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.team} - {p.role})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={simulating || !selectedMatch}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {simulating ? 'Simulating...' : 'Simulate Match & Generate Points'}
            </button>
          </form>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-4">
              <button
                onClick={handleReset}
                disabled={simulating}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-5 w-5" />
                Reset All Points & Matches
              </button>
              <button
                onClick={async () => {
                  setSimulating(true);
                  await updateAllTeamPoints();
                  setMessage({ type: 'success', text: 'Leaderboard refreshed!' });
                  setSimulating(false);
                }}
                disabled={simulating}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-5 w-5" />
                Refresh Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
