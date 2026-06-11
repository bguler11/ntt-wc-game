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
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: scrolled ? '0.75rem 0' : '0 0 2rem 0', 
        borderBottom: scrolled ? '1px solid var(--glass-border)' : '1px solid var(--glass-border)', 
        marginBottom: '2rem',
        position: 'sticky',
        top: 0,
        backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        zIndex: 50,
        transition: 'all 0.3s ease'
      }}>
        <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, fontSize: scrolled ? '0px' : '1.5rem', transition: 'all 0.3s ease' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 'bold' }}>
              {username || currentUser.email.split('@')[0]}
            </span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <LogOut size={16} />
              Çıkış
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
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
