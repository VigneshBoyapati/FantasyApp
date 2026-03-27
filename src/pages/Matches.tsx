import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Trophy, Users, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn, isMatchLocked } from '../lib/utils';

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'scheduled' | 'completed'>('scheduled');
  const [userTeamCounts, setUserTeamCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const { data: matchesData } = await supabase
          .from('matches')
          .select('*')
          .order('match_date', { ascending: true });

        setMatches(matchesData || []);

        if (user) {
          const { data: teams } = await supabase
            .from('teams')
            .select('match_id')
            .eq('user_id', user.id);

          const counts: Record<string, number> = {};
          teams?.forEach((team) => {
            counts[team.match_id] = (counts[team.match_id] || 0) + 1;
          });
          setUserTeamCounts(counts);
        }
      } catch (error) {
        console.error('Error loading matches:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [user]);

  const filteredMatches = matches.filter((m) => m.status === filter);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading matches...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
          <p className="text-gray-500 mt-1">Select a match to create your fantasy team</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setFilter('scheduled')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              filter === 'scheduled'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            Scheduled
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={cn(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              filter === 'completed'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            Completed
          </button>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No matches found</h3>
          <p className="text-gray-500 mt-1">There are no {filter} matches at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMatches.map((match) => {
            const teamCount = userTeamCounts[match.id] || 0;
            const isCompleted = match.status === 'completed';
            const locked = isMatchLocked(match.match_date, match.match_time);
            const canCreateTeam = !isCompleted && !locked;

            return (
              <div
                key={match.id}
                className={cn(
                  'bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md',
                  (isCompleted || locked) && 'opacity-80'
                )}
              >
                <div className={cn(
                  'px-6 py-4 border-b flex justify-between items-center',
                  isCompleted ? 'bg-green-50 border-green-100' : 
                  locked ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'
                )}>
                  <span className={cn(
                    'text-xs font-bold px-2.5 py-1 rounded-full',
                    isCompleted ? 'bg-green-100 text-green-700' : 
                    locked ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'
                  )}>
                    Match {match.match_number}
                  </span>
                  <span className={cn(
                    'text-xs font-semibold uppercase tracking-wider flex items-center gap-1',
                    isCompleted ? 'text-green-600' : 
                    locked ? 'text-gray-600' : 'text-blue-600'
                  )}>
                    {locked && !isCompleted && <Lock className="h-3 w-3" />}
                    {isCompleted ? match.status : locked ? 'Locked' : match.status}
                  </span>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-black text-gray-900">{match.home_team}</div>
                    </div>
                    <div className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      VS
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-black text-gray-900">{match.away_team}</div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {format(new Date(match.match_date), 'EEE, MMM d, yyyy')} • {match.match_time}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      {match.venue}
                    </div>
                    {isCompleted && match.winner_team && (
                      <div className="flex items-center text-sm font-semibold text-green-600">
                        <Trophy className="h-4 w-4 mr-2" />
                        Winner: {match.winner_team}
                      </div>
                    )}
                  </div>

                  {teamCount > 0 && (
                    <div className="mb-6 flex items-center gap-2 text-sm font-medium text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-100">
                      <Users className="h-4 w-4" />
                      You have {teamCount} team{teamCount > 1 ? 's' : ''} here
                    </div>
                  )}

                  <div className="flex gap-3 mt-auto">
                    <Link
                      to={canCreateTeam ? `/create-team/${match.id}` : '#'}
                      onClick={(e) => !canCreateTeam && e.preventDefault()}
                      className={cn(
                        'flex-1 text-center py-2.5 rounded-lg font-medium transition-colors',
                        !canCreateTeam
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {isCompleted ? 'Match Ended' : locked ? 'Match Started' : 'Create Team'}
                    </Link>
                    <Link
                      to={`/leaderboard?match=${match.id}`}
                      className="flex-1 text-center py-2.5 rounded-lg font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      Leaderboard
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
