import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, query, orderBy, where, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { differenceInHours, differenceInMinutes, parseISO, isAfter } from 'date-fns';
import { ChevronLeft, ChevronRight, Eye, MessageCircle, Send, Trash2, AlertCircle, Edit2, Check, X, Share2 } from 'lucide-react';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const initialDateSet = useRef(false);
  const { currentUser } = useAuth();

  const [dailyLeaders, setDailyLeaders] = useState([]);
  const [loadingDailyLeaders, setLoadingDailyLeaders] = useState(false);

  // Comments State
  const [comments, setComments] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");

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

  // History Modal State
  const [historyModal, setHistoryModal] = useState({ isOpen: false, activeTeam: null, matches: [], groupName: null, groupStandings: [] });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, commentId: null });

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(matchesData);

      if (matchesData.length > 0 && !initialDateSet.current) {
        initialDateSet.current = true;
        const grouped = matchesData.reduce((acc, match) => {
          const dateObj = parseISO(match.date);
          const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(match);
          return acc;
        }, {});
        
        const keys = Object.keys(grouped);
        const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
        
        let idx = keys.findIndex(k => k === todayStr);
        if (idx === -1) {
          const now = new Date();
          idx = keys.findIndex(k => isAfter(parseISO(grouped[k][0].date), now));
        }
        if (idx === -1) idx = Math.max(0, keys.length - 1);
        
        setCurrentDateIndex(idx);
      }
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

  useEffect(() => {
    if (!currentMatches || currentMatches.length === 0) {
      setDailyLeaders([]);
      setComments({});
      return;
    }

    const allMatchIds = currentMatches.map(m => m.id);

    const allMatchesFinished = currentMatches.every(m => m.status === 'FINISHED');
    const activeMatches = currentMatches.filter(m => m.status === 'FINISHED' && m.result?.home !== undefined);
    
    if (!allMatchesFinished || activeMatches.length === 0) {
      setDailyLeaders([]);
    } else {
      const activeMatchIds = activeMatches.map(m => m.id);
      
      const fetchDailyLeaders = async () => {
        setLoadingDailyLeaders(true);
        try {
          const q = query(collection(db, 'predictions'), where('matchId', 'in', activeMatchIds));
          const snap = await getDocs(q);
          
          const userPoints = {};
          
          snap.forEach(doc => {
            const pred = doc.data();
            const match = activeMatches.find(m => m.id === pred.matchId);
            if (!match) return;

            const predHome = Number(pred.homeScore);
            const predAway = Number(pred.awayScore);
            const actualHome = Number(match.result.home);
            const actualAway = Number(match.result.away);

            const actualDiff = actualHome - actualAway;
            const predDiff = predHome - predAway;

            const isExact = (actualHome === predHome && actualAway === predAway);
            const isWinner = (Math.sign(actualDiff) === Math.sign(predDiff));
            // Beraberlik durumlarında (actualDiff === 0) fark (isDiff) kuralı uygulanmaz
            const isDiff = (actualDiff !== 0 && actualDiff === predDiff);

            let points = 0;
            if (isExact) points = 3;
            else if (isDiff) points = 2;
            else if (isWinner) points = 1;

            if (points > 0 && pred.userId) {
              if (!userPoints[pred.userId]) userPoints[pred.userId] = { points: 0, exactCount: 0 };
              userPoints[pred.userId].points += points;
              if (isExact) userPoints[pred.userId].exactCount += 1;
            }
          });

          const leaders = Object.entries(userPoints)
            .map(([userId, data]) => ({ userId, points: data.points, exactCount: data.exactCount }))
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              return b.exactCount - a.exactCount;
            })
            .slice(0, 3);
            
          setDailyLeaders(leaders);
        } catch (err) {
          console.error("Günün yıldızları hesaplanamadı", err);
        }
        setLoadingDailyLeaders(false);
      };

      fetchDailyLeaders();
    }

    const qComments = query(collection(db, 'comments'), where('matchId', 'in', allMatchIds));
    const unsubscribeComments = onSnapshot(qComments, (snap) => {
      const newComments = {};
      snap.forEach(doc => {
        const data = doc.data();
        if (!newComments[data.matchId]) newComments[data.matchId] = [];
        newComments[data.matchId].push({ id: doc.id, ...data });
      });
      Object.keys(newComments).forEach(mId => {
        newComments[mId].sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0);
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0);
          return tA - tB;
        });
      });
      setComments(newComments);
    }, (error) => {
      console.error("Yorumlar çekilemedi:", error);
    });

    return () => unsubscribeComments();
  }, [currentDateIndex, matches]);

  const toggleComments = (matchId) => {
    setExpandedComments(prev => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  const handleCommentChange = (matchId, value) => {
    setCommentInputs(prev => ({ ...prev, [matchId]: value }));
  };

  const openHistoryModal = (teamName) => {
    const teamMatches = matches.filter(m => m.homeTeam === teamName || m.awayTeam === teamName);
    teamMatches.sort((a, b) => parseISO(a.date) - parseISO(b.date));
    
    const activeTeamGroupMatch = teamMatches.find(m => m.group && m.group.startsWith('GROUP_'));
    const groupName = activeTeamGroupMatch ? activeTeamGroupMatch.group : null;
    
    let groupStandings = [];
    if (groupName) {
      const groupMatches = matches.filter(m => m.group === groupName);
      const standingsMap = {};
      
      groupMatches.forEach(m => {
        if (!standingsMap[m.homeTeam]) standingsMap[m.homeTeam] = { name: m.homeTeam, flag: m.homeFlag, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
        if (!standingsMap[m.awayTeam]) standingsMap[m.awayTeam] = { name: m.awayTeam, flag: m.awayFlag, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
      });

      groupMatches.forEach(m => {
        if (m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED') {
          if (m.result.home !== null && m.result.away !== null) {
             const hScore = Number(m.result.home);
             const aScore = Number(m.result.away);
             
             standingsMap[m.homeTeam].p += 1;
             standingsMap[m.homeTeam].gf += hScore;
             standingsMap[m.homeTeam].ga += aScore;
             standingsMap[m.homeTeam].gd += (hScore - aScore);

             standingsMap[m.awayTeam].p += 1;
             standingsMap[m.awayTeam].gf += aScore;
             standingsMap[m.awayTeam].ga += hScore;
             standingsMap[m.awayTeam].gd += (aScore - hScore);

             if (hScore > aScore) {
               standingsMap[m.homeTeam].w += 1;
               standingsMap[m.homeTeam].pts += 3;
               standingsMap[m.awayTeam].l += 1;
             } else if (aScore > hScore) {
               standingsMap[m.awayTeam].w += 1;
               standingsMap[m.awayTeam].pts += 3;
               standingsMap[m.homeTeam].l += 1;
             } else {
               standingsMap[m.homeTeam].d += 1;
               standingsMap[m.homeTeam].pts += 1;
               standingsMap[m.awayTeam].d += 1;
               standingsMap[m.awayTeam].pts += 1;
             }
          }
        }
      });
      
      groupStandings = Object.values(standingsMap).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
    }

    setHistoryModal({ isOpen: true, activeTeam: teamName, matches: teamMatches, groupName, groupStandings });
  };

  const confirmDeleteComment = async () => {
    if (!deleteModal.commentId) return;
    try {
      await updateDoc(doc(db, 'comments', deleteModal.commentId), { isDeleted: true });
      setDeleteModal({ isOpen: false, commentId: null });
    } catch (error) {
      console.error("Yorum silinemedi:", error);
      showToast("Yorum gizlenirken bir hata oluştu.", "error");
    }
  };

  const submitComment = async (matchId) => {
    const text = commentInputs[matchId]?.trim();
    if (!text) return;

    setCommentLoading(true);
    try {
      const commentRef = doc(collection(db, 'comments'));
      await setDoc(commentRef, {
        matchId: matchId,
        userId: currentUser.uid,
        text: text,
        createdAt: new Date()
      });
      setCommentInputs(prev => ({ ...prev, [matchId]: '' }));
    } catch (err) {
      console.error("Yorum gönderilemedi", err);
      showToast("Yorum gönderilemedi.", "error");
    }
    setCommentLoading(false);
  };

  const submitEditComment = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await updateDoc(doc(db, 'comments', commentId), { text: editCommentText.trim(), isEdited: true, updatedAt: new Date() });
      setEditingCommentId(null);
      setEditCommentText("");
    } catch (err) {
      console.error("Yorum düzenlenemedi", err);
      showToast("Yorum düzenlenemedi.", "error");
    }
  };

  const toggleReaction = async (commentId, reactionType) => {
    try {
      let commentToReact = null;
      for (const matchId in comments) {
        const found = comments[matchId].find(c => c.id === commentId);
        if (found) {
          commentToReact = found;
          break;
        }
      }
      if (!commentToReact) return;
      
      const currentReactions = commentToReact[reactionType] || [];
      let newReactions;
      if (currentReactions.includes(currentUser.uid)) {
        newReactions = currentReactions.filter(id => id !== currentUser.uid);
      } else {
        newReactions = [...currentReactions, currentUser.uid];
      }
      
      await updateDoc(doc(db, 'comments', commentId), { [reactionType]: newReactions });
    } catch (err) {
      console.error("Reaksiyon eklenemedi:", err);
      showToast("Bir hata oluştu.", "error");
    }
  };

  const forwardToGlobalChat = async (comment, match) => {
    try {
      const authorName = usersMap[comment.userId]?.username || usersMap[comment.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
      await addDoc(collection(db, 'global_chat'), {
        text: "",
        userId: currentUser.uid,
        createdAt: new Date(),
        isForwarded: true,
        forwardedText: comment.text,
        forwardedAuthor: authorName,
        forwardedMatch: `${match.homeTeam} vs ${match.awayTeam}`
      });
      showToast("Yorum Ana Kulis'e iletildi!", "success");
    } catch (err) {
      console.error("Yorum iletilemedi:", err);
      showToast("Yorum iletilemedi.", "error");
    }
  };

  const forwardPredictionToGlobalChat = async (pred, match) => {
    try {
      const authorName = usersMap[pred.userId]?.username || usersMap[pred.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
      await addDoc(collection(db, 'global_chat'), {
        text: "",
        userId: currentUser.uid,
        createdAt: new Date(),
        isForwarded: true,
        forwardedText: `Tahmin: ${pred.homeScore} - ${pred.awayScore}`,
        forwardedAuthor: authorName,
        forwardedMatch: `${match.homeTeam} vs ${match.awayTeam}`
      });
      showToast("Tahmin Ana Kulis'e iletildi!", "success");
    } catch (err) {
      console.error("Tahmin iletilemedi:", err);
      showToast("Tahmin iletilemedi.", "error");
    }
  };

  if (matches.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Maçlar Yükleniyor...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Eğer uzun sürerse veritabanınızı kontrol edin.</p>
      </div>
    );
  }

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

      {/* Günün Yıldızları */}
      {dailyLeaders.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            🌟 Günün Yıldızları 🌟
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', marginTop: 0 }}>
            {loadingDailyLeaders ? "Puanlar hesaplanıyor..." : "Oynanan maçlarda en yüksek puanı toplayan günün en iyi kahinleri!"}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {dailyLeaders.map((leader, index) => {
              const name = usersMap[leader.userId]?.username || usersMap[leader.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
              return (
                <div key={leader.userId} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '12px', minWidth: '120px' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{medal}</div>
                  <div style={{ fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    {usersMap[leader.userId]?.favoriteFlag && <img src={usersMap[leader.userId].favoriteFlag} alt="flag" width="16" style={{ borderRadius: '2px' }} />}
                    {name}
                  </div>
                  <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>{leader.points} Puan</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seçili Günün Maçları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {currentMatches.map(match => {
          const matchDate = parseISO(match.date);
          const now = new Date();
          const totalHoursLeft = differenceInHours(matchDate, now);
          const totalMinutesLeft = differenceInMinutes(matchDate, now);
          const isLocked = isAfter(now, matchDate) || totalMinutesLeft < 15;
          const isMatchStarted = isAfter(now, matchDate) || ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status);

          let timeLeftStr = "";
          if (isAfter(matchDate, now)) {
            const daysLeft = Math.floor(totalHoursLeft / 24);
            const hoursLeft = totalHoursLeft % 24;
            const minutesLeft = differenceInHours(matchDate, now) === 0 ? 0 : Math.floor((matchDate.getTime() - now.getTime()) / (1000 * 60)) % 60;
            
            if (daysLeft > 0) timeLeftStr = `${daysLeft} gün ${hoursLeft} saat`;
            else if (hoursLeft > 0) timeLeftStr = `${hoursLeft} saat ${minutesLeft} dk`;
            else timeLeftStr = `${minutesLeft} dk`;
          }

          const isTurkeyMatch = ['Turkey', 'Türkiye', 'Turkiye'].includes(match.homeTeam) || ['Turkey', 'Türkiye', 'Turkiye'].includes(match.awayTeam);

          return (
            <div key={match.id} className={`glass-card match-card ${isTurkeyMatch ? 'turkey-match-card' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              
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
                <div className="team-info" onClick={() => openHistoryModal(match.homeTeam)}>
                  {match.homeFlag !== '🌐' ? (
                     <img src={match.homeFlag} alt={match.homeTeam} />
                  ) : (
                     <span className="team-emoji">🌐</span>
                  )}
                  <span className="team-name">{match.homeTeam}</span>
                </div>

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

                <div className="team-info" onClick={() => openHistoryModal(match.awayTeam)}>
                  {match.awayFlag !== '🌐' ? (
                     <img src={match.awayFlag} alt={match.awayTeam} />
                  ) : (
                     <span className="team-emoji">🌐</span>
                  )}
                  <span className="team-name">{match.awayTeam}</span>
                </div>
              </div>

              {(match.status === 'IN_PLAY' || match.status === 'PAUSED') && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.5rem 1rem', 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444', 
                  fontWeight: 'bold', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  width: '100%'
                }}>
                  <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                  CANLI SKOR: {match.result?.home ?? 0} - {match.result?.away ?? 0}
                  {match.status === 'PAUSED' && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(Devre Arası)</span>}
                </div>
              )}

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

              <button 
                className="btn btn-secondary submit-prediction-btn" 
                style={{ marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.875rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                onClick={() => toggleComments(match.id)}
              >
                <MessageCircle size={18} /> {expandedComments[match.id] ? 'Kulisi Gizle' : `Maç Kulisi (${comments[match.id]?.length || 0})`}
              </button>

              {expandedComments[match.id] && (
                <div style={{ width: '100%', marginTop: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
                    {(() => {
                      const activeComments = comments[match.id]?.filter(c => !c.isDeleted) || [];
                      return activeComments.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem 0' }}>
                          Henüz yorum yok. İlk taşı sen at! 🎯
                        </div>
                      ) : (
                        activeComments.map(c => {
                          const isMine = c.userId === currentUser.uid;
                          const userName = usersMap[c.userId]?.username || usersMap[c.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
                          const isEditing = editingCommentId === c.id;
                          return (
                            <div key={c.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                              <div style={{ 
                                maxWidth: '80%', 
                                padding: '0.5rem 0.75rem', 
                                borderRadius: '12px', 
                                backgroundColor: isMine ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isMine ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-border)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                position: 'relative'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: isMine ? 'var(--success)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {usersMap[c.userId]?.favoriteFlag && <img src={usersMap[c.userId].favoriteFlag} alt="flag" width="14" style={{ borderRadius: '2px' }} />}
                                    {isMine ? 'Sen' : userName}
                                  </span>
                                  {isMine && !isEditing && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button 
                                        onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.text); }}
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                                        title="Yorumu Düzenle"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button 
                                        onClick={() => setDeleteModal({ isOpen: true, commentId: c.id })}
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                                        title="Yorumu Sil"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <input 
                                      type="text" 
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') submitEditComment(c.id); else if (e.key === 'Escape') setEditingCommentId(null); }}
                                      style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', fontSize: '0.875rem' }}
                                      autoFocus
                                    />
                                    <button onClick={() => submitEditComment(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: 0 }}><Check size={14} /></button>
                                    <button onClick={() => setEditingCommentId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.875rem', wordBreak: 'break-word', color: 'white' }}>
                                    {c.text} {c.isEdited && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginLeft: '0.25rem' }}>(düzenlendi)</span>}
                                  </span>
                                )}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  <button
                                    onClick={() => toggleReaction(c.id, 'likes')}
                                    style={{ 
                                      background: c.likes?.includes(currentUser.uid) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)', 
                                      border: `1px solid ${c.likes?.includes(currentUser.uid) ? 'rgba(59, 130, 246, 0.4)' : 'var(--glass-border)'}`, 
                                      color: c.likes?.includes(currentUser.uid) ? '#60a5fa' : 'var(--text-secondary)', 
                                      borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' 
                                    }}
                                  >
                                    👍 {c.likes?.length || 0}
                                  </button>
                                  <button
                                    onClick={() => toggleReaction(c.id, 'laughs')}
                                    style={{ 
                                      background: c.laughs?.includes(currentUser.uid) ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)', 
                                      border: `1px solid ${c.laughs?.includes(currentUser.uid) ? 'rgba(234, 179, 8, 0.4)' : 'var(--glass-border)'}`, 
                                      color: c.laughs?.includes(currentUser.uid) ? '#facc15' : 'var(--text-secondary)', 
                                      borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' 
                                    }}
                                  >
                                    😂 {c.laughs?.length || 0}
                                  </button>
                                  <button
                                    onClick={() => forwardToGlobalChat(c, match)}
                                    style={{ 
                                      background: 'rgba(245, 158, 11, 0.1)', 
                                      border: '1px solid rgba(245, 158, 11, 0.3)', 
                                      color: 'var(--warning)', 
                                      borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                                      marginLeft: 'auto'
                                    }}
                                    title="Bu mesajı Ana Kulis'e yolla"
                                  >
                                    <Share2 size={12} /> Ana Kulis'e Gönder
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      );
                    })()}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Bir şeyler yaz..."
                      value={commentInputs[match.id] || ''}
                      onChange={(e) => handleCommentChange(match.id, e.target.value)}
                      disabled={commentLoading}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitComment(match.id); }}
                      style={{ 
                        flex: 1, 
                        padding: '0.5rem 1rem', 
                        borderRadius: '20px', 
                        border: '1px solid var(--glass-border)', 
                        backgroundColor: 'rgba(0,0,0,0.3)', 
                        color: 'white',
                        outline: 'none'
                      }}
                    />
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '0.5rem 1rem', borderRadius: '20px' }}
                      disabled={commentLoading || !commentInputs[match.id]?.trim()}
                      onClick={() => submitComment(match.id)}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

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
                            {u?.favoriteFlag && <img src={u.favoriteFlag} alt="flag" width="16" style={{ borderRadius: '2px' }} />}
                            {name}
                            {pred.userId === currentUser?.uid && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>(Sen)</span>}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                            <button
                              onClick={() => forwardPredictionToGlobalChat(pred, selectedMatch)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--warning)',
                                cursor: 'pointer',
                                padding: '0.25rem'
                              }}
                              title="Bu tahmini Ana Kulis'e yolla"
                            >
                              <Share2 size={16} />
                            </button>
                          </div>
                        </li>
                      );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Takım Fikstürü Modalı */}
      {historyModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📅 {historyModal.activeTeam} Analizi
              </h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.75rem', borderRadius: '8px' }} 
                onClick={() => setHistoryModal({ isOpen: false, activeTeam: null, matches: [], groupName: null, groupStandings: [] })}
              >
                Kapat
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Puan Durumu Tablosu */}
              {historyModal.groupStandings && historyModal.groupStandings.length > 0 && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🏆 {historyModal.groupName.replace('_', ' ')} PUAN DURUMU
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>TAKIM</div>
                    <div style={{ textAlign: 'center' }} title="Oynanan">O</div>
                    <div style={{ textAlign: 'center' }} title="Galibiyet">G</div>
                    <div style={{ textAlign: 'center' }} title="Beraberlik">B</div>
                    <div style={{ textAlign: 'center' }} title="Mağlubiyet">M</div>
                    <div style={{ textAlign: 'center', color: 'var(--accent-primary)' }} title="Puan">P</div>
                  </div>
                  {historyModal.groupStandings.map((st, idx) => (
                    <div key={st.name} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', alignItems: 'center', padding: '0.5rem 0', borderBottom: idx !== historyModal.groupStandings.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', backgroundColor: st.name === historyModal.activeTeam ? 'rgba(16, 185, 129, 0.15)' : 'transparent', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: st.name === historyModal.activeTeam ? 'bold' : 'normal', color: 'white' }}>
                        <span style={{ width: '12px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{idx + 1}.</span>
                        {st.flag !== '🌐' ? <img src={st.flag} width="16" alt="flag" /> : '🌐'}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</span>
                      </div>
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{st.p}</div>
                      <div style={{ textAlign: 'center', color: 'var(--success)' }}>{st.w}</div>
                      <div style={{ textAlign: 'center', color: 'var(--warning)' }}>{st.d}</div>
                      <div style={{ textAlign: 'center', color: 'var(--danger)' }}>{st.l}</div>
                      <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{st.pts}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fikstür */}
              <div>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  ⚽ Maç Geçmişi ve Gelecek Fikstür
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {historyModal.matches.map(hm => {
                    const isHome = hm.homeTeam === historyModal.activeTeam;
                    
                    const hmDate = parseISO(hm.date);
                    const isFinished = hm.status === 'FINISHED';
                    
                    let scoreText = "-";
                    let resultColor = 'var(--glass-border)';
                    
                    if (isFinished) {
                      const hScore = hm.result.home;
                      const aScore = hm.result.away;
                      scoreText = `${hScore} - ${aScore}`;
                      
                      const myScore = isHome ? hScore : aScore;
                      const oppScore = isHome ? aScore : hScore;
                      
                      if (myScore > oppScore) resultColor = 'var(--success)';
                      else if (myScore < oppScore) resultColor = 'var(--danger)';
                      else resultColor = 'var(--warning)';
                    } else if (hm.status === 'IN_PLAY' || hm.status === 'PAUSED') {
                      const hScore = hm.result?.home || 0;
                      const aScore = hm.result?.away || 0;
                      scoreText = `${hScore} - ${aScore}`;
                      resultColor = '#ef4444';
                    }
                    
                    return (
                      <div key={hm.id} style={{
                        display: 'flex', flexDirection: 'column',
                        padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px', borderLeft: `4px solid ${resultColor}`
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textAlign: 'center' }}>
                          {hmDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {hmDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          {hm.status === 'IN_PLAY' && <span style={{ color: '#ef4444', marginLeft: '0.5rem', fontWeight: 'bold' }}>(Canlı)</span>}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: isHome ? 'bold' : 'normal', color: isHome ? 'var(--accent-primary)' : 'white', textAlign: 'right', fontSize: '0.9rem' }}>{hm.homeTeam}</span>
                            {hm.homeFlag !== '🌐' ? <img src={hm.homeFlag} width="24" alt="flag" /> : '🌐'}
                          </div>
                          
                          <div style={{ fontWeight: 'bold', color: isFinished || hm.status === 'IN_PLAY' ? 'white' : 'var(--text-secondary)', fontSize: '1.2rem', backgroundColor: 'rgba(0,0,0,0.4)', padding: '0.25rem 0.75rem', borderRadius: '8px', margin: '0 0.5rem', minWidth: '60px', textAlign: 'center', border: `1px solid ${resultColor}` }}>
                            {scoreText}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-start' }}>
                            {hm.awayFlag !== '🌐' ? <img src={hm.awayFlag} width="24" alt="flag" /> : '🌐'}
                            <span style={{ fontWeight: !isHome ? 'bold' : 'normal', color: !isHome ? 'var(--accent-primary)' : 'white', fontSize: '0.9rem' }}>{hm.awayTeam}</span>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      {deleteModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1100, 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', padding: '2rem' }}>
            <AlertCircle size={48} color="var(--danger)" />
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'white' }}>Yorumu Sil</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Bu yorumu silmek (gizlemek) istediğinize emin misiniz?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px' }} 
                onClick={() => setDeleteModal({ isOpen: false, commentId: null })}
              >
                İptal
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', backgroundColor: 'var(--danger)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }} 
                onClick={confirmDeleteComment}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
