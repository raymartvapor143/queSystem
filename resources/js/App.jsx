import './bootstrap';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import QueueDisplay from './pages/QueueDisplay';
import AdminPanel from './pages/AdminPanel';
import { ThemeProvider } from './components/ThemeProvider';

function App() {
    return (
        <ThemeProvider>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/display" element={<QueueDisplay />} />
                    <Route path="/admin" element={<AdminPanel />} />
                </Routes>
            </div>
        </ThemeProvider>
    );
}

const rootElement = document.getElementById('app');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </React.StrictMode>
    );
}

export default App;