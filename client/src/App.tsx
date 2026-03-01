import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CreateCall from './components/CreateCall';
import JoinCall from './components/JoinCall';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateCall />} />
        <Route path="/c/:token" element={<JoinCall />} />
      </Routes>
    </BrowserRouter>
  );
}
