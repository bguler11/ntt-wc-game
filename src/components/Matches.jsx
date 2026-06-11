import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { differenceInHours, parseISO, isAfter } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
      alert("Bu maç için tahmin süresi dolmuştur! (Maça 1 saatten az kaldı veya maç başladı)");
      return;
    }

    const prediction = predictions[matchId];
    if (!prediction || prediction.home === undefined || prediction.away === undefined || prediction.home === '' || prediction.away === '') {
      alert("Lütfen her iki takım için de skor giriniz.");
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
      alert("Tahmininiz başarıyla kaydedildi!");
    } catch (error) {
      console.error("Tahmin kaydedilirken hata oluştu:", error);
      alert("Hata oluştu. Veritabanı bağlantınızı kontrol edin.");
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

  // Maçları günlere göre gruplama
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
          const hoursLeft = differenceInHours(matchDate, new Date());
          const isLocked = isAfter(new Date(), matchDate) || hoursLeft < 1;

          return (
            <div key={match.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              
              {isLocked && (
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0 var(--border-radius) 0 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  TAHMİNLER KAPALI
                </div>
              )}

              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div>Saat: {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                {match.status === 'FINISHED' && <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '4px' }}>MAÇ SONUCU: {match.result?.home} - {match.result?.away}</div>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', width: '100%', justifyContent: 'center' }}>
                {/* Home Team */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  {match.homeFlag !== '🌐' ? (
                     <img src={match.homeFlag} alt={match.homeTeam} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                  ) : (
                     <span style={{ fontSize: '3rem' }}>🌐</span>
                  )}
                  <span style={{ fontWeight: '600', marginTop: '0.5rem', textAlign: 'center' }}>{match.homeTeam}</span>
                </div>

                {/* Score Inputs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input 
                    type="number" 
                    min="0"
                    disabled={isLocked}
                    value={predictions[match.id]?.home ?? ''}
                    onChange={(e) => handlePredictionChange(match.id, 'home', e.target.value)}
                    style={{ width: '60px', height: '60px', fontSize: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '12px' }}
                  />
                  <span style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>-</span>
                  <input 
                    type="number" 
                    min="0"
                    disabled={isLocked}
                    value={predictions[match.id]?.away ?? ''}
                    onChange={(e) => handlePredictionChange(match.id, 'away', e.target.value)}
                    style={{ width: '60px', height: '60px', fontSize: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '12px' }}
                  />
                </div>

                {/* Away Team */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  {match.awayFlag !== '🌐' ? (
                     <img src={match.awayFlag} alt={match.awayTeam} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                  ) : (
                     <span style={{ fontSize: '3rem' }}>🌐</span>
                  )}
                  <span style={{ fontWeight: '600', marginTop: '0.5rem', textAlign: 'center' }}>{match.awayTeam}</span>
                </div>
              </div>

              <button 
                className={`btn ${isLocked ? 'btn-secondary' : 'btn-primary'}`} 
                disabled={isLocked || loading}
                onClick={() => submitPrediction(match.id)}
                style={{ marginTop: '1.5rem', width: '200px' }}
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
