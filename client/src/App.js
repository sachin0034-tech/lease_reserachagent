import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LeaseForecasterForm from './components/LeaseForecasterForm';
import AnalysisScreen from './components/AnalysisScreen';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<LeaseForecasterForm />} />
          <Route path="/analyze" element={<AnalysisScreen />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
