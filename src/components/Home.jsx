import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Matches from './Matches';
import logo from '../assets/logo.png';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Home() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
          if (userSnap.exists() && userSnap.data().username) {
            setUsername(userSnap.data().username);
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
            <span className="header-user-name">
              {username || currentUser.email.split('@')[0]}
            </span>
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
        <button onClick={() => navigate('/leaderboard')} className="btn btn-secondary">
          🏆 Liderlik Tablosu
        </button>
      </div>

      <Matches />
    </div>
  );
}
