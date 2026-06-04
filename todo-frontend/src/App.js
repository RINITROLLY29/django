import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import Login from "./Login";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"; 

import { signOut } from "firebase/auth";
import { auth } from "./firebase";

// UPDATED: ShareInput is now for the Whole Board
const ShareInput = ({ onShare }) => {
  const [text, setText] = useState("");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input 
        type="text"
        style={{ 
          fontSize: 13, 
          padding: "8px 14px", 
          width: '200px', 
          borderRadius: '20px', 
          border: '1px solid #333', 
          background: '#1a1a1a', 
          color: 'white',
          outline: 'none'
        }} 
        placeholder="Invite email to board..." 
        value={text} 
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
           if(e.key === 'Enter') { onShare(text); setText(""); }
        }}
      />
      <button 
        style={{ 
          fontSize: 12, 
          cursor: 'pointer', 
          background: '#00adb5', 
          color: 'white', 
          border: 'none', 
          borderRadius: '20px', 
          padding: '0 15px',
          fontWeight: '600'
        }} 
        onClick={() => { onShare(text); setText(""); }}
      >
        Invite
      </button>
    </div>
  );
};

function App() {
  const API_URL = "http://127.0.0.1:8000/api/todos/";
  const REQ_URL = "http://127.0.0.1:8000/api/requests/";
  const COLLAB_URL = "http://127.0.0.1:8000/api/collaborators/";

  const savedUser = localStorage.getItem("username");
  const [user, setUser] = useState(savedUser);
  const [todos, setTodos] = useState([]);
  const [requests, setRequests] = useState([]);
  const [collaborators, setCollaborators] = useState([]); // NEW STATE
  const [newTodo, setNewTodo] = useState("");
  const [tick, setTick] = useState(0);

  const [undoTodo, setUndoTodo] = useState(null);
  const [showUndoPopup, setShowUndoPopup] = useState(false);
  const [undoTimer, setUndoTimer] = useState(null);

  const fetchTodos = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(API_URL, { headers: { Authorization: `Token ${token}` } });
      setTodos(res.data);
    } catch (err) { if (err.response?.status === 401) handleLogout(); }
  };

  const fetchRequests = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(REQ_URL, { headers: { Authorization: `Token ${token}` } });
      setRequests(res.data);
    } catch (err) { console.error(err); }
  };

  // NEW: Fetch active collaborators
  const fetchCollaborators = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(COLLAB_URL, { headers: { Authorization: `Token ${token}` } });
      setCollaborators(res.data);
    } catch (err) { console.error(err); }
  };

  // NEW: Remove collaborator function
  const removeCollaborator = async (collabId) => {
    if (!window.confirm("Remove this collaborator from your board?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${COLLAB_URL}${collabId}/remove/`, {
        headers: { Authorization: `Token ${token}` },
      });
      fetchCollaborators();
      fetchTodos();
    } catch (err) {
      alert("Error removing collaborator");
    }
  };

  const handleRequestAction = async (requestId, action) => {
    const token = localStorage.getItem("token");
    try {
      await axios.post(`${REQ_URL}${requestId}/handle/`, { action: action }, { headers: { Authorization: `Token ${token}` } });
      fetchRequests(); 
      fetchTodos(); 
      fetchCollaborators();
    } catch (err) { alert("Error handling request"); }
  };

  const handleShare = async (targetEmail) => {
    if (!targetEmail) return;
    const token = localStorage.getItem("token");
    try {
      await axios.post(`${API_URL}share/`, { username: targetEmail }, { headers: { Authorization: `Token ${token}` } });
      alert(`Board access request sent to ${targetEmail}`);
      fetchRequests();
    } catch (err) { alert(err.response?.data?.error || "Error sharing board"); }
  };

  const deleteTodo = async (id) => {
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${API_URL}${id}/`, { headers: { Authorization: `Token ${token}` } });
      fetchTodos();
    } catch (err) { console.error(err); }
  };

  const handlePermanentDelete = (todo) => {
    const todoId = todo.id;
    const token = localStorage.getItem("token");
    setTodos(prev => prev.filter(t => t.id !== todoId));
    setUndoTodo(todo);
    setShowUndoPopup(true);
    if (undoTimer) clearTimeout(undoTimer);

    const timer = setTimeout(async () => {
        try {
            await axios.delete(`${API_URL}${todoId}/permanent/`, { 
                headers: { Authorization: `Token ${token}` } 
            });
            setShowUndoPopup(false);
            setUndoTodo(null);
        } catch (err) {
            console.error("Error permanently deleting:", err);
            fetchTodos(); 
        }
    }, 5000);
    setUndoTimer(timer);
  };

  const cancelPermanentDelete = () => {
    if (undoTimer) {
        clearTimeout(undoTimer);
        setTodos(prev => [...prev, undoTodo]);
        setShowUndoPopup(false);
        setUndoTodo(null);
        setUndoTimer(null);
    }
  };

  const archiveTodo = async (todo) => {
    const token = localStorage.getItem("token");
    let spent = todo.time_spent || 0;
    if (todo.progress && todo.time_started) spent += Math.floor((new Date() - new Date(todo.time_started)) / 1000);
    try {
      await axios.patch(`${API_URL}${todo.id}/`, { archived: true, progress: false, completed: false, time_spent: spent, time_started: null }, { headers: { Authorization: `Token ${token}` } });
      fetchTodos();
    } catch (err) { console.error(err); }
  };

  const restoreArchive = async (todo) => {
    const token = localStorage.getItem("token");
    try {
      await axios.patch(`${API_URL}${todo.id}/`, { archived: false, is_deleted: false }, { headers: { Authorization: `Token ${token}` } });
      fetchTodos();
    } catch (err) { console.error(err); }
  };

  const formatTime = (s = 0) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const getLiveTime = (t) => {
    if (!t.progress || !t.time_started) return t.time_spent || 0;
    return (t.time_spent || 0) + Math.floor((Date.now() - new Date(t.time_started).getTime()) / 1000);
  };

  const handleLogout = () => { 
    localStorage.clear(); 
    setUser(null); 
    signOut(auth); 
  };

  useEffect(() => { 
    if (user) { 
      fetchTodos(); 
      fetchRequests(); 
      fetchCollaborators();
      const interval = setInterval(() => { 
        fetchTodos(); 
        fetchRequests(); 
        fetchCollaborators();
      }, 5000); 
      return () => clearInterval(interval);
    } 
  }, [user]);

  useEffect(() => { const interval = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(interval); }, []);

  const renderItem = (t, provided) => (
    <div ref={provided.innerRef} {...provided.draggableProps}
      style={{ 
        padding: "16px", 
        marginBottom: "12px", 
        background: "#2a2a2a", 
        borderRadius: "10px", 
        borderLeft: "4px solid #512c33",
        boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
        ...provided.draggableProps.style 
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div {...provided.dragHandleProps} style={{ cursor: "grab", flex: 1 }}>
          <strong style={{ color: "#eee", fontSize: "14px", display: "block", marginBottom: "4px" }}>{t.title}</strong>
          <div style={{ fontSize: "11px", color: "#00adb5", fontWeight: "600", letterSpacing: "0.5px" }}>
            {t.progress ? "● RUNNING: " : "⏱ "}{formatTime(getLiveTime(t))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            title="Archive Task" 
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", filter: "grayscale(1) brightness(1.5)" }} 
            onClick={() => archiveTodo(t)}
          >
            📦
          </button>
          <button 
            title="Delete Task" 
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", opacity: 0.7 }} 
            onClick={() => deleteTodo(t.id)}
          >
            ❌
          </button>
        </div>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  const todoList = todos.filter((t) => !t.progress && !t.completed && !t.archived && !t.is_deleted);
  const progressList = todos.filter((t) => t.progress && !t.completed && !t.archived && !t.is_deleted);
  const doneList = todos.filter((t) => t.completed && !t.archived && !t.is_deleted);
  const archivedItems = todos.filter((t) => t.archived && !t.is_deleted);
  const recycleBinItems = todos.filter((t) => t.is_deleted);

  return (
    <div style={{ padding: "40px 20px", background: "#121212", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "white" }}>
      
      {showUndoPopup && (
        <div style={{
          position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
          background: "#333", color: "white", padding: "14px 24px", borderRadius: "12px",
          display: "flex", gap: 20, alignItems: "center", zIndex: 1000, boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
          border: "1px solid #444"
        }}>
          <span style={{ fontSize: "14px" }}>Permanently deleting <b>{undoTodo?.title}</b></span>
          <button onClick={cancelPermanentDelete} style={{ background: "#512c33", color: "white", border: "none", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>UNDO</button>
        </div>
      )}

      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: "28px", 
            fontWeight: "900", 
            letterSpacing: "-1px", 
            display: "flex", 
            gap: "8px",
            textTransform: "uppercase" 
          }}>
            <span style={{ color: "white" }}>TASK</span>
            <span style={{ color: "#00adb5" }}>HUB</span>
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <ShareInput onShare={handleShare} />
            <div style={{ display: "flex", alignItems: "center", gap: "15px", background: "#1e1e1e", padding: "6px 6px 6px 16px", borderRadius: "30px", border: "1px solid #333" }}>
              <span style={{ fontSize: "13px", color: "#aaa" }}>User: <b style={{ color: "white" }}>{user}</b></span>
              <button onClick={handleLogout} style={{ padding: "8px 18px", cursor: "pointer", borderRadius: "20px", border: "none", background: "#512c33", color: "white", fontSize: "12px", fontWeight: "600" }}>Logout</button>
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS AND COLLABORATORS ROW */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
            {/* INVITATIONS */}
            {requests.length > 0 && (
            <div style={{ flex: 2, padding: "20px", background: "linear-gradient(to right, #00adb522, #121212)", borderRadius: "12px", border: "1px solid #00adb544" }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: "#00adb5" }}>🔔 Board Invitations</h3>
                {requests.map((req) => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "10px 15px", borderRadius: "8px", marginBottom: 8 }}>
                    <span style={{ fontSize: "13px" }}>
                        {req.is_receiver ? 
                            (<span><b>{req.from}</b> invited you to collaborate</span>) : 
                            (<span>Request to <b>{req.to_user}</b> is <b>{req.status}</b></span>)
                        }
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                    {req.is_receiver && req.status === 'pending' ? (
                        <>
                        <button onClick={() => handleRequestAction(req.id, "accept")} style={{ fontSize: "11px", background: "#00adb5", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold" }}>Accept</button>
                        <button onClick={() => handleRequestAction(req.id, "decline")} style={{ fontSize: "11px", background: "transparent", color: "white", border: "1px solid #666", padding: "6px 12px", borderRadius: "4px" }}>Decline</button>
                        </>
                    ) : (
                        <button onClick={() => handleRequestAction(req.id, "clear")} style={{ fontSize: "11px", background: "#333", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px" }}>Dismiss</button>
                    )}
                    </div>
                </div>
                ))}
            </div>
            )}

            {/* COLLABORATORS LIST */}
            <div style={{ flex: 1, padding: "20px", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333" }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", color: "#aaa" }}>👥 Collaborators</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {collaborators.length === 0 ? <span style={{fontSize: "12px", color: "#555"}}>No active collaborators</span> : 
                        collaborators.map(c => (
                            <div key={c.id} style={{ background: "#333", padding: "5px 12px", borderRadius: "20px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ width: "8px", height: "8px", background: "#4caf50", borderRadius: "50%" }}></div>
                                {c.name}
                                <button 
                                  onClick={() => removeCollaborator(c.id)}
                                  style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold", marginLeft: "4px", fontSize: "14px", padding: "0 2px" }}
                                  title="Remove Collaborator"
                                >
                                  ×
                                </button>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: "50px" }}>
          <input 
            value={newTodo} 
            onChange={(e) => setNewTodo(e.target.value)} 
            placeholder="What needs to be done?" 
            style={{ padding: "14px 20px", width: "400px", borderRadius: "10px", border: "1px solid #333", background: "#1e1e1e", color: "white", outline: "none", fontSize: "15px" }} 
          />
          <button onClick={async () => {
              if(!newTodo) return;
              const token = localStorage.getItem("token");
              await axios.post(API_URL, { title: newTodo }, { headers: { Authorization: `Token ${token}` } });
              setNewTodo(""); fetchTodos();
          }} style={{ padding: "0 30px", borderRadius: "10px", background: "#00adb5", color: "white", border: "none", fontWeight: "700", cursor: "pointer" }}>Add Task</button>
        </div>

        <DragDropContext onDragEnd={(res) => {
            if (!res.destination) return;
            const todo = todos.find(t => String(t.id) === res.draggableId);
            if (!todo) return;
            const col = res.destination.droppableId;
            const now = new Date().toISOString();
            let totalSpentSoFar = todo.time_spent || 0;
            if (todo.progress && todo.time_started) totalSpentSoFar += Math.floor((new Date() - new Date(todo.time_started)) / 1000);

            let patch = col === "progress" ? {progress:true, completed:false, time_started: now} : 
                        col === "done" ? {completed:true, progress:false, time_started: null, time_spent: totalSpentSoFar} : 
                        {progress:false, completed:false, time_started: null, time_spent: totalSpentSoFar};
            
            axios.patch(`${API_URL}${todo.id}/`, patch, { headers: { Authorization: `Token ${localStorage.getItem("token")}` } }).then(fetchTodos);
        }}>
          <div style={{ display: "flex", gap: "24px", overflowX: "auto", paddingBottom: "20px" }}>
            {["todo", "progress", "done"].map((col) => (
              <Droppable key={col} droppableId={col}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} style={{ minWidth: "300px", flex: 1, background: "#1e1e1e", padding: "20px", borderRadius: "16px", border: "1px solid #2a2a2a" }}>
                    <h2 style={{ textAlign: "left", fontSize: "13px", color: "#666", marginBottom: "20px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px" }}>{col}</h2>
                    {(col === "todo" ? todoList : col === "progress" ? progressList : doneList).map((t, i) => (
                      <Draggable key={t.id} draggableId={String(t.id)} index={i}>
                        {(prov) => renderItem(t, prov)}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}

            <div style={{ minWidth: "300px", flex: 1, background: "#1e1e1e", padding: "20px", borderRadius: "16px", border: "1px solid #2a2a2a", opacity: 0.8 }}>
              <h2 style={{ textAlign: "left", fontSize: "13px", color: "#666", marginBottom: "20px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px" }}>Archive</h2>
              {archivedItems.map(t => (
                  <div key={t.id} style={{ padding: "14px", marginBottom: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px dashed #444" }}>
                      <span style={{ color: "#888", fontSize: "14px" }}>{t.title}</span>
                      <button style={{ background: "#333", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }} onClick={() => restoreArchive(t)}>Restore</button>
                  </div>
              ))}
            </div>

            <div style={{ minWidth: "300px", flex: 1, background: "#1e1e1e", padding: "20px", borderRadius: "16px", border: "1px solid #2a2a2a", opacity: 0.8 }}>
              <h2 style={{ textAlign: "left", fontSize: "13px", color: "#b91c1c", marginBottom: "20px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px" }}>Recycle Bin</h2>
              {recycleBinItems.map(t => (
                  <div key={t.id} style={{ padding: "14px", marginBottom: "10px", background: "rgba(185, 28, 28, 0.05)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: 10, border: "1px solid #331111" }}>
                      <span style={{ color: "#eee", fontSize: "14px" }}>{t.title}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ flex: 1, background: "#333", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }} onClick={() => restoreArchive(t)}>Restore</button>
                          <button style={{ flex: 1, background: "#512c33", color: "white", border: "none", padding: "6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }} onClick={() => handlePermanentDelete(t)}>Purge</button>
                      </div>
                  </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

export default App;