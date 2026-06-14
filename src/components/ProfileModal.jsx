import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, User } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const [username, setUsername] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [favoriteFlag, setFavoriteFlag] = useState("");
  const [teamsList, setTeamsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch User Data
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUsername(data.username || currentUser.email.split('@')[0]);
          setFavoriteTeam(data.favoriteTeam || "");
          setFavoriteFlag(data.favoriteFlag || "");
        } else {
          setUsername(currentUser.email.split('@')[0]);
        }

        // Fetch Teams from Matches
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const teamsMap = {};
        matchesSnap.forEach(d => {
          const m = d.data();
          if (m.homeTeam && m.homeFlag && m.homeFlag !== '🌐') teamsMap[m.homeTeam] = m.homeFlag;
          if (m.awayTeam && m.awayFlag && m.awayFlag !== '🌐') teamsMap[m.awayTeam] = m.awayFlag;
        });
        
        // Sort alphabetically
        const sortedTeams = Object.keys(teamsMap).sort().map(team => ({
          name: team,
          flag: teamsMap[team]
        }));
        
        setTeamsList(sortedTeams);
      } catch (err) {
        console.error("Profil verisi çekilemedi", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [isOpen, currentUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      const updateData = {
        username: username.trim(),
        favoriteTeam: favoriteTeam,
        favoriteFlag: favoriteFlag,
        updatedAt: new Date()
      };

      if (userSnap.exists()) {
        await updateDoc(userRef, updateData);
      } else {
        await setDoc(userRef, {
          email: currentUser.email,
          createdAt: new Date(),
          ...updateData
        });
      }
      setMessage({ type: 'success', text: 'Profil başarıyla güncellendi!' });
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 1500);
    } catch (err) {
      console.error("Profil güncellenemedi:", err);
      setMessage({ type: 'error', text: 'Güncelleme sırasında hata oluştu.' });
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
            <User size={20} /> Profil Ayarları
          </h3>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.25rem', borderRadius: '50%' }} 
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {message && (
          <div style={{ 
            padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.875rem',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`
          }}>
            {message.text}
          </div>
        )}

        {loading && teamsList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>Yükleniyor...</div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Kullanıcı Adı</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
                  backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: '1rem'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Favori Ülke</label>
              <select 
                value={favoriteTeam} 
                onChange={(e) => {
                  const team = e.target.value;
                  setFavoriteTeam(team);
                  const selectedTeamData = teamsList.find(t => t.name === team);
                  if (selectedTeamData) {
                    setFavoriteFlag(selectedTeamData.flag);
                  } else {
                    setFavoriteFlag("");
                  }
                }}
                style={{
                  padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
                  backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', outline: 'none', fontSize: '1rem',
                  appearance: 'none', cursor: 'pointer'
                }}
              >
                <option value="">-- Ülke Seçin --</option>
                {teamsList.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              {favoriteFlag && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Seçilen Bayrak:</span>
                  <img src={favoriteFlag} alt={favoriteTeam} width="24" style={{ borderRadius: '4px' }} />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ padding: '0.75rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              <Save size={20} /> Kaydet
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
