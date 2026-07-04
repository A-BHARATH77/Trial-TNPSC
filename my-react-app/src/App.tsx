import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './App.css';

interface MarkEntry {
  id: string;
  attempt: number;
  marks: number;
  created_at: string;
}

interface UploadItem {
  id: string;
  type: 'pdf' | 'link';
  content: string;
  file_url?: string;
  category: string;
  marksHistory: MarkEntry[];
}

function App() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [linkInputVisible, setLinkInputVisible] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const [activeModal, setActiveModal] = useState<{ type: 'add' | 'view', itemId: string } | null>(null);
  const [marksInput, setMarksInput] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [category, setCategory] = useState<'prelims' | 'mains' | null>(null);

  useEffect(() => {
    if (category) {
      fetchData();
    }
  }, [category]);

  const fetchData = async () => {
    if (!category) return;
    
    setIsLoadingData(true);

    const { data: uploadsData, error: uploadsError } = await supabase
      .from('uploads')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: true });

    if (uploadsError) {
      console.error("Error fetching uploads:", uploadsError);
      setIsLoadingData(false);
      return;
    }

    const { data: marksData, error: marksError } = await supabase
      .from('marks')
      .select('*')
      .order('attempt', { ascending: true });

    if (marksError) {
      console.error("Error fetching marks:", marksError);
      setIsLoadingData(false);
      return;
    }

    const merged = uploadsData.map((u: any) => ({
      ...u,
      marksHistory: marksData.filter((m: any) => m.upload_id === u.id)
    }));

    setUploads(merged);
    setIsLoadingData(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setIsUploading(true);
        
        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: storageError } = await supabase.storage
          .from('pdfs')
          .upload(fileName, file);
          
        if (storageError) {
          console.error("Storage error:", storageError);
          setToastMessage("Error uploading file to storage.");
          setIsUploading(false);
          setTimeout(() => setToastMessage(null), 3000);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from('pdfs').getPublicUrl(fileName);
        const fileUrl = publicUrlData.publicUrl;

        // Insert into uploads table
        const { data: insertData, error: insertError } = await supabase
          .from('uploads')
          .insert([{ type: 'pdf', content: file.name, file_url: fileUrl, category }])
          .select()
          .single();

        if (insertError) {
          console.error("Database error:", insertError);
          setToastMessage("Error saving to database.");
          setIsUploading(false);
          setTimeout(() => setToastMessage(null), 3000);
          return;
        }

        setUploads(prev => [...prev, { ...insertData, marksHistory: [] }]);
        setToastMessage("PDF uploaded and saved successfully!");
        setIsUploading(false);
        setTimeout(() => setToastMessage(null), 3000);

      } else {
        alert("Please upload a valid PDF file.");
      }
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linkValue.trim()) {
      const { data, error } = await supabase
        .from('uploads')
        .insert([{ type: 'link', content: linkValue.trim(), category }])
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        return;
      }
      
      setUploads(prev => [...prev, { ...data, marksHistory: [] }]);
      setLinkValue("");
      setLinkInputVisible(false);
    }
  };

  const handleAddMarksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || activeModal.type !== 'add') return;

    const parsedMarks = parseInt(marksInput, 10);
    if (!isNaN(parsedMarks)) {
      const item = uploads.find(u => u.id === activeModal.itemId);
      if (!item) return;

      const attempt = item.marksHistory.length + 1;

      const { data, error } = await supabase
        .from('marks')
        .insert([{ upload_id: item.id, attempt, marks: parsedMarks }])
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        setToastMessage("Error saving marks.");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      setUploads(prev => prev.map(u => {
        if (u.id === activeModal.itemId) {
          return { ...u, marksHistory: [...u.marksHistory, data] };
        }
        return u;
      }));

      setActiveModal(null);
      setMarksInput("");
      setToastMessage("Marks saved successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setMarksInput("");
  };

  if (!category) {
    return (
      <div className="container center-container">
        <h1 className="title landing-title">TNPSC Portal</h1>
        <p className="landing-subtitle">Select a section to proceed</p>
        <div className="landing-grid">
          <div className="glass-box landing-card" onClick={() => setCategory('prelims')}>
            <div className="landing-icon">📝</div>
            <h2>Prelims</h2>
            <p>Upload and manage Prelims questions.</p>
          </div>
          <div className="glass-box landing-card" onClick={() => setCategory('mains')}>
            <div className="landing-icon">🏛️</div>
            <h2>Mains</h2>
            <p>Upload and manage Mains questions.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <button className="btn glass-btn back-btn" onClick={() => setCategory(null)}>
            ← Back
          </button>
          <h1 className="title">
            {category === 'prelims' ? 'Prelims Questions' : 'Mains Questions'}
          </h1>
        </div>
        <div className="options">
          <label className="btn glass-btn">
            Upload PDF
            <input 
              type="file" 
              accept=".pdf,application/pdf" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
          </label>
          <button className="btn glass-btn" onClick={() => setLinkInputVisible(!linkInputVisible)}>
            Upload Link
          </button>
        </div>
      </header>
      
      {linkInputVisible && (
        <div className="link-input-container">
          <form onSubmit={handleLinkSubmit} className="link-form">
            <input 
              type="url" 
              placeholder="Enter link URL (e.g. https://...)" 
              value={linkValue} 
              onChange={(e) => setLinkValue(e.target.value)}
              className="link-input"
              autoFocus
              required
            />
            <button type="submit" className="btn submit-btn">Add Link</button>
          </form>
        </div>
      )}

      <main className="content">
        {isLoadingData ? (
          <div className="empty-state" style={{ border: 'none' }}>
            <div className="loader-spinner"></div>
            <p style={{ marginTop: '1rem' }}>Loading questions...</p>
          </div>
        ) : uploads.length > 0 ? (
          <div className="grid">
            {uploads.map(item => (
              <div key={item.id} className="box glass-box">
                <div className="box-top-right">
                  <span className="attempt-indicator">Attempt {item.marksHistory.length}</span>
                </div>
                <div className="box-icon">
                  {item.type === 'pdf' ? '📄' : '🔗'}
                </div>
                <div className="box-content">
                  <p className="box-text" title={item.content}>
                    {item.type === 'link' ? (
                      <a href={item.content} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.content}
                      </a>
                    ) : item.file_url ? (
                      <a href={item.file_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.content}
                      </a>
                    ) : (
                      item.content
                    )}
                  </p>
                  <span className="box-badge">{item.type.toUpperCase()}</span>
                </div>
                
                <div className="box-actions">
                  <button className="btn glass-btn action-btn" onClick={() => setActiveModal({ type: 'add', itemId: item.id })}>
                    Add Marks
                  </button>
                  <button className="btn glass-btn action-btn" onClick={() => setActiveModal({ type: 'view', itemId: item.id })}>
                    View Marks
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No questions uploaded yet. Upload a PDF or add a link to begin.</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {activeModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content glass-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            
            {activeModal.type === 'add' && (
              <div className="modal-body">
                <h2>Add Marks</h2>
                <form onSubmit={handleAddMarksSubmit} className="modal-form">
                  <input 
                    type="number" 
                    placeholder="Enter marks" 
                    value={marksInput}
                    onChange={(e) => setMarksInput(e.target.value)}
                    className="modal-input"
                    autoFocus
                    required
                  />
                  <button type="submit" className="btn submit-btn">Save Marks</button>
                </form>
              </div>
            )}

            {activeModal.type === 'view' && (
              <div className="modal-body">
                <h2>Marks History</h2>
                {(() => {
                  const item = uploads.find(u => u.id === activeModal.itemId);
                  if (!item || item.marksHistory.length === 0) {
                    return <p className="text-secondary">No marks recorded yet.</p>;
                  }
                  return (
                    <table className="marks-table">
                      <thead>
                        <tr>
                          <th>Attempt</th>
                          <th>Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.marksHistory.map(entry => (
                          <tr key={entry.id}>
                            <td>{entry.attempt}</td>
                            <td>{entry.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast">
          {toastMessage}
        </div>
      )}

      {isUploading && (
        <div className="loader-overlay">
          <div className="loader-spinner"></div>
          <p>Uploading your PDF...</p>
        </div>
      )}
    </div>
  )
}

export default App;
