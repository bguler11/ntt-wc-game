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
    const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem', width: '60px', textAlign: 'center' }}>Sıra</th>
                  <th style={{ padding: '1rem' }}>Oyuncu</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Puan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr 
                    key={user.id} 
                    style={{ 
                      borderBottom: index !== users.length - 1 ? '1px solid var(--glass-border)' : 'none',
                      backgroundColor: index === 0 ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                      transition: 'var(--transition)'
                    }}
                  >
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: index < 3 ? '1.25rem' : '1rem' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {/* Daha eski kullanıcıların username'i yoksa e-postasının başını kullan fallback olarak */}
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                        {user.username || user.email?.split('@')[0] || 'İsimsiz Oyuncu'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Tam Skor: {user.exactMatches || 0} | Kazanan: {user.correctWinners || 0}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                      {user.points || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
