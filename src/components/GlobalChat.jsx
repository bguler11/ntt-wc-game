import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Send, X, Share2, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';

const FootballChatIcon = ({ size = 28 }) => (
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <MessageCircle size={size} strokeWidth={2} />
    <span style={{ position: 'absolute', bottom: '-4px', right: '-6px', fontSize: `${size * 0.6}px`, textShadow: '0 0 4px rgba(0,0,0,0.5)' }}>⚽</span>
  </div>
);

export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersMap, setUsersMap] = useState({});
  const { currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const [lastRead, setLastRead] = useState(() => parseInt(localStorage.getItem('lastReadGlobalChat') || '0', 10));
  const [hasUnread, setHasUnread] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editMsgText, setEditMsgText] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, msgId: null });

  const formatStylishTime = (dateValue) => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue.seconds ? dateValue.seconds * 1000 : dateValue);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0 && date.getDate() === now.getDate()) {
      return `Bugün ${timeStr}`;
    } else if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
      return `Dün ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${timeStr}`;
    }
  };

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

  useEffect(() => {
    if (messages.length > 0) {
      const newestMessage = messages[messages.length - 1];
      const newestTime = newestMessage.createdAt?.toMillis ? newestMessage.createdAt.toMillis() : (newestMessage.createdAt?.seconds ? newestMessage.createdAt.seconds * 1000 : Date.now());
      if (!isOpen && newestTime > lastRead && newestMessage.userId !== currentUser?.uid) {
        setHasUnread(true);
      }
    }
  }, [messages, isOpen, lastRead, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      const now = Date.now();
      setLastRead(now);
      localStorage.setItem('lastReadGlobalChat', now.toString());
    }
  }, [isOpen]);

  const confirmDeleteMsg = async () => {
    if (!deleteModal.msgId) return;
    try {
      await updateDoc(doc(db, 'global_chat', deleteModal.msgId), { isDeleted: true });
      setDeleteModal({ isOpen: false, msgId: null });
    } catch (error) {
      console.error("Mesaj silinemedi:", error);
    }
  };

  const submitEditMsg = async (msgId) => {
    if (!editMsgText.trim()) return;
    try {
      await updateDoc(doc(db, 'global_chat', msgId), { text: editMsgText.trim(), isEdited: true, updatedAt: new Date() });
      setEditingMsgId(null);
      setEditMsgText("");
    } catch (err) {
      console.error("Mesaj düzenlenemedi", err);
    }
  };

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
          <FootballChatIcon size={32} />
          {hasUnread && (
            <span style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '12px',
              height: '12px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              border: '2px solid var(--accent-primary)',
              boxShadow: '0 0 8px rgba(239,68,68,0.8)'
            }} />
          )}
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
            <FootballChatIcon size={24} /> Ana Kulis
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
          {messages.filter(m => !m.isDeleted).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
              Henüz mesaj yok. İlk mesajı sen gönder!
            </div>
          ) : (
            messages.filter(m => !m.isDeleted).map((msg) => {
              const isMine = msg.userId === currentUser?.uid;
              const userName = usersMap[msg.userId]?.username || usersMap[msg.userId]?.email?.split('@')[0] || 'Gizemli Oyuncu';
              const isEditing = editingMsgId === msg.id;
              
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {msg.isForwarded && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Share2 size={10} /> {msg.forwardedMatch}
                          </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                          {formatStylishTime(msg.createdAt)}
                        </span>
                        {isMine && !isEditing && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }}
                              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                              title="Mesajı Düzenle"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => setDeleteModal({ isOpen: true, msgId: msg.id })}
                              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0 }}
                              title="Mesajı Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {msg.isForwarded ? (
                      <div style={{ marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', borderLeft: '2px solid var(--warning)', paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                          "{msg.forwardedText}" - {msg.forwardedAuthor}
                        </div>
                        {msg.text && <span style={{ fontSize: '0.875rem', color: 'white' }}>{msg.text}</span>}
                      </div>
                    ) : isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input 
                          type="text" 
                          value={editMsgText}
                          onChange={(e) => setEditMsgText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitEditMsg(msg.id); else if (e.key === 'Escape') setEditingMsgId(null); }}
                          style={{ flex: 1, padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none', fontSize: '0.875rem' }}
                          autoFocus
                        />
                        <button onClick={() => submitEditMsg(msg.id)} style={{ background: 'transparent', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: 0 }}><Check size={14} /></button>
                        <button onClick={() => setEditingMsgId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: 'white', wordBreak: 'break-word' }}>
                        {msg.text} {msg.isEdited && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginLeft: '0.25rem' }}>(düzenlendi)</span>}
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

      {/* Silme Onay Modalı */}
      {deleteModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 11000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ width: '100%', maxWidth: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', padding: '2rem', backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <AlertCircle size={48} color="#ef4444" />
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'white' }}>Mesajı Sil</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Bu mesajı silmek (gizlemek) istediğinize emin misiniz?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }} 
                onClick={() => setDeleteModal({ isOpen: false, msgId: null })}
              >
                İptal
              </button>
              <button 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }} 
                onClick={confirmDeleteMsg}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
