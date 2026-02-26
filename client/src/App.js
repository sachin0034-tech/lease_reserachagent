import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LeaseForecasterForm from './components/LeaseForecasterForm';
import AnalysisScreen from './components/AnalysisScreen';
import Dashboard from './components/Dashboard';
import AuthLanding from './components/AuthLanding';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<AuthLanding />} />
          <Route
            path="/start"
            element={
              <ProtectedRoute>
                <LeaseForecasterForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyze"
            element={
              <ProtectedRoute>
                <AnalysisScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
