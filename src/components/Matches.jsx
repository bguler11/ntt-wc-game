import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { differenceInHours, parseISO, isAfter } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const { currentUser } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(matchesData);
    }, (error) => {
      console.error("Maçlar çekilemedi:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    const qPred = query(collection(db, 'predictions'), where('userId', '==', currentUser.uid));
    const unsubscribePred = onSnapshot(qPred, (querySnapshot) => {
      const preds = {};
      querySnapshot.forEach(doc => {
        const data = doc.data();
        preds[data.matchId] = {
          home: data.homeScore,
          away: data.awayScore
        };
      });
      setPredictions(prev => ({ ...prev, ...preds }));
    }, (error) => {
      console.error("Tahminler çekilemedi:", error);
    });

    return () => unsubscribePred();
  }, [currentUser]);

  const handlePredictionChange = (matchId, team, value) => {
    if (value < 0) return;
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value
      }
    }));
  };

  const submitPrediction = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const matchDate = parseISO(match.date);
    const now = new Date();
    
    const hoursDifference = differenceInHours(matchDate, now);
    
    if (isAfter(now, matchDate) || hoursDifference < 1) {
      toast.error("Bu maç için tahmin süresi dolmuştur! (Maça 1 saatten az kaldı veya maç başladı)");
      return;
    }

    const prediction = predictions[matchId];
    if (!prediction || prediction.home === undefined || prediction.away === undefined || prediction.home === '' || prediction.away === '') {
      toast.error("Lütfen her iki takım için de skor giriniz.");
      return;
    }

    setLoading(true);
    try {
      const predictionRef = doc(db, 'predictions', `${currentUser.uid}_${matchId}`);
      await setDoc(predictionRef, {
        userId: currentUser.uid,
        matchId: matchId,
        homeScore: Number(prediction.home),
        awayScore: Number(prediction.away),
        updatedAt: new Date()
      });
      toast.success("Tahmininiz başarıyla kaydedildi!");
    } catch (error) {
      console.error("Tahmin kaydedilirken hata oluştu:", error);
      toast.error("Hata oluştu. Veritabanı bağlantınızı kontrol edin.");
    }
    setLoading(false);
  };

  if (matches.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Maçlar Yükleniyor...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Eğer uzun sürerse veritabanınızı kontrol edin.</p>
      </div>
    );
  }

  const groupedMatches = matches.reduce((acc, match) => {
    const dateObj = parseISO(match.date);
    const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(match);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedMatches);
  const currentKey = dateKeys[currentDateIndex];
  const currentMatches = groupedMatches[currentKey];

  const handlePrevDay = () => {
    setCurrentDateIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextDay = () => {
    setCurrentDateIndex(prev => Math.min(dateKeys.length - 1, prev + 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Gün Navigasyonu */}
      <div className="glass-card" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '1rem',
        position: 'sticky',
        top: '1rem',
        zIndex: 10
      }}>
        <button 
          onClick={handlePrevDay} 
          disabled={currentDateIndex === 0}
          className="btn btn-secondary"
          style={{ padding: '0.5rem', opacity: currentDateIndex === 0 ? 0.5 : 1 }}
        >
          <ChevronLeft size={24} />
        </button>
        
        <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', textAlign: 'center', margin: 0 }}>
          📅 {currentKey}
        </h3>
        
        <button 
          onClick={handleNextDay} 
          disabled={currentDateIndex === dateKeys.length - 1}
          className="btn btn-secondary"
          style={{ padding: '0.5rem', opacity: currentDateIndex === dateKeys.length - 1 ? 0.5 : 1 }}
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Seçili Günün Maçları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {currentMatches.map(match => {
          const matchDate = parseISO(match.date);
          const now = new Date();
          const totalHoursLeft = differenceInHours(matchDate, now);
          const isLocked = isAfter(now, matchDate) || totalHoursLeft < 1;

          let timeLeftStr = "";
          if (isAfter(matchDate, now)) {
            const daysLeft = Math.floor(totalHoursLeft / 24);
            const hoursLeft = totalHoursLeft % 24;
            const minutesLeft = differenceInHours(matchDate, now) === 0 ? 0 : Math.floor((matchDate.getTime() - now.getTime()) / (1000 * 60)) % 60;
            
            if (daysLeft > 0) timeLeftStr = `${daysLeft} gün ${hoursLeft} saat`;
            else if (hoursLeft > 0) timeLeftStr = `${hoursLeft} saat ${minutesLeft} dk`;
            else timeLeftStr = `${minutesLeft} dk`;
          }

          return (
            <div key={match.id} className="glass-card match-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              
              {isLocked && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0 var(--border-radius) 0 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  TAHMİNLER KAPALI
                </div>
              )}

              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>
                  <span style={{ fontWeight: '600', color: 'white' }}>Saat: {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {timeLeftStr && <span style={{ marginLeft: '0.5rem', color: 'var(--accent-primary)' }}>({timeLeftStr} kaldı)</span>}
                </div>
                {match.status === 'FINISHED' && <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '4px' }}>MAÇ SONUCU: {match.result?.home} - {match.result?.away}</div>}
              </div>

              <div className="match-row">
                {/* Home Team */}
                <div className="team-info">
                  {match.homeFlag !== '🌐' ? (
                     <img src={match.homeFlag} alt={match.homeTeam} />
                  ) : (
                     <span className="team-emoji">🌐</span>
                  )}
                  <span className="team-name">{match.homeTeam}</span>
                </div>

                {/* Score Inputs */}
                <div className="score-inputs">
                  <input 
                    className="score-input"
                    type="number" 
                    min="0"
                    disabled={isLocked}
                    value={predictions[match.id]?.home ?? ''}
                    onChange={(e) => handlePredictionChange(match.id, 'home', e.target.value)}
                  />
                  <span className="score-divider">-</span>
                  <input 
                    className="score-input"
                    type="number" 
                    min="0"
                    disabled={isLocked}
                    value={predictions[match.id]?.away ?? ''}
                    onChange={(e) => handlePredictionChange(match.id, 'away', e.target.value)}
                  />
                </div>

                {/* Away Team */}
                <div className="team-info">
                  {match.awayFlag !== '🌐' ? (
                     <img src={match.awayFlag} alt={match.awayTeam} />
                  ) : (
                     <span className="team-emoji">🌐</span>
                  )}
                  <span className="team-name">{match.awayTeam}</span>
                </div>
              </div>

              <button 
                className={`btn ${isLocked ? 'btn-secondary' : 'btn-primary'} submit-prediction-btn`} 
                disabled={isLocked || loading}
                onClick={() => submitPrediction(match.id)}
              >
                {isLocked ? 'Kilitlendi' : 'Tahmini Kaydet'}
              </button>

            </div>
          );
        })}
      </div>
    </div>
  );
}
