import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Matches from './Matches';
import logo from '../assets/logo.png';

export default function Home() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: 0 }}>
          <img src={logo} alt="Dünya Kupası Logo" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          Dünya Kupası Tahmin
        </h1>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {currentUser.email}
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
