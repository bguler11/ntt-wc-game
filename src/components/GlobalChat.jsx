import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Send, X, Share2 } from 'lucide-react';

export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersMap, setUsersMap] = useState({});
  const { currentUser } = useAuth();
  const messagesEndRef = useRef(null);

  useEffect(() => {
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

    // Sohbet mesajlarını dinle (son 50 mesajı getir)
    const q = query(collection(db, 'global_chat'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      // Ters çeviriyoruz çünkü en yeniden en eskiye sıraladık, render ederken eskiden yeniye olmalı
      setMessages(msgs.reverse());
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    try {
      await addDoc(collection(db, 'global_chat'), {
        text: newMessage.trim(),
        userId: currentUser.uid,
        createdAt: new Date(),
        isForwarded: false
      });
      setNewMessage("");
    } catch (error) {
      console.error("Mesaj gönderilemedi:", error);
    }
  };

  return (
    <>
      {/* Yüzen Buton (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 9999,
            transition: 'transform 0.3s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Küresel Sohbet"
        >
          <MessageSquare size={28} />
        </button>
      )}

      {/* Yan Panel (Drawer) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : '-100%',
          width: '100%',
          maxWidth: '400px',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-4px 0 15px rgba(0,0,0,0.5)',
          zIndex: 10000,
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Üst Kısım / Başlık */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.2)'
        }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
            <MessageSquare size={20} /> Ana Kulis
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Mesaj Listesi */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
              Henüz mesaj yok. İlk mesajı sen gönder!
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.userId === currentUser?.uid;
              const userName = usersMap[msg.userId]?.username || usersMap[msg.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
              
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: msg.isForwarded 
                      ? 'rgba(245, 158, 11, 0.15)' // İletilen mesajlar için özel arka plan (turuncu)
                      : (isMine ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'),
                    border: `1px solid ${
                      msg.isForwarded ? 'rgba(245, 158, 11, 0.3)' 
                      : (isMine ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-border)')
                    }`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isMine ? 'var(--success)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {usersMap[msg.userId]?.favoriteFlag && <img src={usersMap[msg.userId].favoriteFlag} alt="flag" width="14" style={{ borderRadius: '2px' }} />}
                        {isMine ? 'Sen' : userName}
                      </span>
                      {msg.isForwarded && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Share2 size={10} /> {msg.forwardedMatch}
                        </span>
                      )}
                    </div>
                    
                    {msg.isForwarded ? (
                      <div style={{ marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', borderLeft: '2px solid var(--warning)', paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                          "{msg.forwardedText}" - {msg.forwardedAuthor}
                        </div>
                        {msg.text && <span style={{ fontSize: '0.875rem', color: 'white' }}>{msg.text}</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: 'white', wordBreak: 'break-word' }}>
                        {msg.text}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Mesaj Gönderme Inputu */}
        <div style={{
          padding: '1rem',
          borderTop: '1px solid var(--glass-border)',
          backgroundColor: 'rgba(0,0,0,0.2)'
        }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Ana kuliste bir şeyler söyle..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                backgroundColor: 'rgba(0,0,0,0.3)',
                color: 'white',
                outline: 'none',
                fontSize: '0.875rem'
              }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="btn btn-primary"
              style={{
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                padding: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: !newMessage.trim() ? 0.5 : 1
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Tıklanınca kapanması için arka plan örtüsü */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999
          }}
        />
      )}
    </>
  );
}
