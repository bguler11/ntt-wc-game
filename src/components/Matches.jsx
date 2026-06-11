import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { differenceInHours, differenceInMinutes, parseISO, isAfter } from 'date-fns';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const { currentUser } = useAuth();

  // Custom Toast State
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };

  // Modal State
  const [usersMap, setUsersMap] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedMatchPredictions, setSelectedMatchPredictions] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(matchesData);
    }, (error) => {
      console.error("Maçlar çekilemedi:", error);
    });

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map = {};
        snap.forEach(doc => {
          map[doc.id] = doc.data();
        });
        setUsersMap(map);
      } catch (error) {
        console.error("Kullanıcılar çekilemedi", error);
      }
    };
    fetchUsers();

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
    
    const minutesDifference = differenceInMinutes(matchDate, now);
    
    if (isAfter(now, matchDate) || minutesDifference < 15) {
      showToast("Bu maç için tahmin süresi dolmuştur! (Maça 15 dakikadan az kaldı veya maç başladı)", "error");
      return;
    }

    const prediction = predictions[matchId];
    if (!prediction || prediction.home === undefined || prediction.away === undefined || prediction.home === '' || prediction.away === '') {
      showToast("Lütfen her iki takım için de skor giriniz.", "error");
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
      showToast("Tahmininiz başarıyla kaydedildi!", "success");
    } catch (error) {
      console.error("Tahmin kaydedilirken hata oluştu:", error);
      showToast("Hata oluştu. Veritabanı bağlantınızı kontrol edin.", "error");
    }
    setLoading(false);
  };

  const handleViewPredictions = async (match) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
    setLoadingModal(true);
    try {
      const q = query(collection(db, 'predictions'), where('matchId', '==', match.id));
      const snap = await getDocs(q);
      const preds = [];
      snap.forEach(doc => {
        preds.push(doc.data());
      });
      setSelectedMatchPredictions(preds);
    } catch (err) {
      console.error(err);
      showToast("Tahminler çekilemedi.", "error");
    }
    setLoadingModal(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
      
      {/* Custom Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toastMsg.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontWeight: 'bold',
          transition: 'all 0.3s ease'
        }}>
          {toastMsg.msg}
        </div>
      )}

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
          const totalMinutesLeft = differenceInMinutes(matchDate, now);
          const isLocked = isAfter(now, matchDate) || totalMinutesLeft < 15;

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

              <button 
                className={`btn ${!isLocked ? 'btn-secondary' : 'btn-primary'} submit-prediction-btn`} 
                style={{ marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.875rem', opacity: !isLocked ? 0.6 : 1, cursor: !isLocked ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (!isLocked) {
                    showToast("Kopya çekmeyi önlemek için, diğer tahminler maç saatine 15 dakika kala (tahminler kilitlendiğinde) açılır.", "error");
                  } else {
                    handleViewPredictions(match);
                  }
                }}
              >
                <Eye size={18} /> {!isLocked ? 'Gizli (Maç Kilitlenince Açılır)' : 'Diğer Tahminleri Gör'}
              </button>

            </div>
          );
        })}
      </div>

      {/* Diğer Tahminleri Gör Modalı */}
      {isModalOpen && selectedMatch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.75rem', borderRadius: '8px' }} 
                onClick={() => setIsModalOpen(false)}
              >
                Kapat
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {loadingModal ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>Tahminler yükleniyor...</div>
              ) : selectedMatchPredictions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>Henüz kimse tahmin yapmamış.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {selectedMatchPredictions
                    .filter(pred => {
                      const u = usersMap[pred.userId];
                      return u && (u.username || u.email);
                    })
                    .map((pred, i) => {
                      const u = usersMap[pred.userId];
                      const name = u.username || u.email?.split('@')[0];
                      return (
                        <li key={i} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '0.75rem', 
                          borderBottom: '1px solid rgba(167, 243, 208, 0.1)',
                          backgroundColor: pred.userId === currentUser?.uid ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          borderRadius: '8px',
                          marginBottom: '4px'
                        }}>
                          <span style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {name}
                            {pred.userId === currentUser?.uid && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>(Sen)</span>}
                          </span>
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: 'white',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)'
                          }}>
                            {pred.homeScore} - {pred.awayScore}
                          </span>
                        </li>
                      );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
