import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Matches from './Matches';
import GlobalChat from './GlobalChat';
import ProfileModal from './ProfileModal';
import logo from '../assets/logo.png';

import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function Home() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [favoriteFlag, setFavoriteFlag] = React.useState('');
  const [scrolled, setScrolled] = React.useState(false);
  const [isLive, setIsLive] = React.useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Aktif maç kontrolü (Arka plandaki ESPN API'nin uyanık olduğu saatler)
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      let active = false;
      const now = new Date();
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'IN_PLAY' || data.status === 'PAUSED') {
          active = true;
        } else if (data.date && data.status !== 'FINISHED') {
          const matchDate = new Date(data.date);
          const diffMinutes = (now - matchDate) / 1000 / 60;
          if (diffMinutes >= -5 && diffMinutes <= 160) {
            active = true;
          }
        }
      });
      setIsLive(active);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (currentUser) {
      const fetchUsername = async () => {
        if (currentUser.displayName) {
          setUsername(currentUser.displayName);
          return;
        }
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUsername(userSnap.data().username || currentUser.email.split('@')[0]);
            setFavoriteFlag(userSnap.data().favoriteFlag || "");
          } else {
            setUsername(currentUser.email.split('@')[0]);
          }
        } catch (err) {
          setUsername(currentUser.email.split('@')[0]);
        }
      };
      fetchUsername();
    }
  }, [currentUser]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Çıkış yapılamadı', error);
    }
  }

  return (
    <div>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>
      <header className={`header-container ${scrolled ? 'scrolled' : ''}`}>
        <h1 className={`text-gradient header-title ${scrolled ? 'scrolled-text' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, transition: 'all 0.3s ease' }}>
          <img src={logo} alt="Dünya Kupası Logo" style={{ width: scrolled ? '36px' : '44px', height: scrolled ? '36px' : '44px', borderRadius: '50%', transition: 'all 0.3s ease' }} />
          <span style={{ 
            opacity: scrolled ? 0 : 1, 
            visibility: scrolled ? 'hidden' : 'visible',
            maxWidth: scrolled ? 0 : '300px', 
            overflow: 'hidden', 
            whiteSpace: 'nowrap', 
            transition: 'all 0.3s ease' 
          }}>
            Dünya Kupası Tahmin
          </span>
        </h1>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div 
              onClick={() => setIsProfileModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
              title="Profil Ayarları"
            >
              {favoriteFlag && <img src={favoriteFlag} alt="Bayrak" width="20" style={{ borderRadius: '2px' }} />}
              <span className="header-user-name" style={{ margin: 0, fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {username || currentUser.email.split('@')[0]}
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary btn-logout" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <LogOut size={16} />
              <span className="header-logout-text">Çıkış</span>
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="btn btn-primary btn-logout" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            Giriş Yap
          </button>
        )}
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Maçlar</h2>
        <button 
          onClick={() => navigate('/leaderboard')} 
          className="btn btn-secondary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: isLive ? '0.85rem' : '1rem', // LIVE etiketi varsa font küçülür
            padding: isLive ? '0.4rem 0.8rem' : '0.5rem 1rem',
            transition: 'all 0.3s ease'
          }}
        >
          🏆 Liderlik Tablosu
          {isLive && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.15rem 0.4rem',
              borderRadius: '9999px',
              animation: 'livePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: 'white', borderRadius: '50%', marginRight: '4px' }}></span>
              LIVE
            </span>
          )}
        </button>
      </div>

      <Matches />
      
      {/* Küresel Sohbet / Ana Kulis */}
      <GlobalChat />

      {/* Profil Ayarları Modalı */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => {
          setIsProfileModalOpen(false);
          // Modalı kapattıktan sonra ismi/bayrağı yenilemek için tetiklenebilir
          if (currentUser) {
            getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
              if (snap.exists()) {
                setUsername(snap.data().username || currentUser.email.split('@')[0]);
                setFavoriteFlag(snap.data().favoriteFlag || "");
              }
            });
          }
        }} 
      />
    </div>
  );
}
