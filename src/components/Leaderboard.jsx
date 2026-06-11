import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Gerçek zamanlı dinleme (onSnapshot) veya tek seferlik getDocs kullanılabilir.
    // Liderlik tablosu sık güncelleneceği için onSnapshot daha etkilidir.
    const q = query(collection(db, 'users'), limit(100)); // Puan sıralamasını istemcide yapacağız
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // İstemci tarafında Toplam Puan (Ana Puan + Canlı Puan) ve Tam İsabet sayısına göre sırala
      usersData.sort((a, b) => {
        const aPoints = (a.points || 0) + (a.livePoints || 0);
        const bPoints = (b.points || 0) + (b.livePoints || 0);
        if (bPoints !== aPoints) return bPoints - aPoints;
        
        const aExact = a.exactMatches || 0;
        const bExact = b.exactMatches || 0;
        return bExact - aExact;
      });

      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error('Liderlik tablosu çekilemedi', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '2rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Trophy size={28} color="var(--warning)" />
          Liderlik Tablosu
        </h1>
      </header>

      <div className="glass-card" style={{ padding: '0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Liderlik tablosu yükleniyor...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Henüz sisteme kayıtlı bir oyuncu yok. İlk giren sen ol!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem', width: '60px', textAlign: 'center' }}>Sıra</th>
                  <th style={{ padding: '1rem' }}>Oyuncu</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Puan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const totalPoints = (user.points || 0) + (user.livePoints || 0);
                  const hasLivePoints = (user.livePoints || 0) > 0;
                  return (
                    <tr 
                      key={user.id} 
                      style={{ 
                        borderBottom: index !== users.length - 1 ? '1px solid var(--glass-border)' : 'none',
                        backgroundColor: index === 0 ? 'rgba(245, 158, 11, 0.1)' : hasLivePoints ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                        transition: 'var(--transition)'
                      }}
                    >
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: index < 3 ? '1.25rem' : '1rem' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                          {user.username || user.email?.split('@')[0] || 'İsimsiz Oyuncu'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Tam Skor (3p): {user.exactMatches || 0} | Fark (2p): {user.diffMatches || 0} | Taraf (1p): {user.correctWinners || 0}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--accent-primary)', position: 'relative' }}>
                        {totalPoints}
                        {hasLivePoints && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '2px', fontWeight: 'bold' }}>
                            (+{user.livePoints} Canlı)
                          </div>
                        )}
                      </td>
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
