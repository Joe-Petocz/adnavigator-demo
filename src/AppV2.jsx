/**
 * Main App Component - Versioned Pipeline Demo
 * Uses stable, cacheable API endpoints
 */

import { useState } from 'react';
import { IntakeStep, IntelligenceStep, CopyAndVideoStep } from './DemoFlow';
import './index.css';

const GOLD_GRADIENT = 'bg-gradient-to-r from-[#FDFBF7] via-[#D4AF37] to-[#AA8220]';

function App() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);

  const handleIntakeSubmit = (newSessionId) => {
    setSessionId(newSessionId);
    setStep(2);
  };

  const handleIntelligenceNext = () => {
    setStep(3);
  };

  // Progress calculation
  const getProgress = () => {
    switch (step) {
      case 1:
        return 0;
      case 2:
        return 33;
      case 3:
        return 66;
      default:
        return 100;
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-[#D4AF37] rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#D4AF37] rounded-full blur-[150px] animate-pulse delay-700" />
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50">
        <div
          className={`h-full ${GOLD_GRADIENT} transition-all duration-500 ease-out`}
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8">
        {step === 1 && <IntakeStep onSubmit={handleIntakeSubmit} />}
        {step === 2 && sessionId && (
          <IntelligenceStep sessionId={sessionId} onNext={handleIntelligenceNext} />
        )}
        {step === 3 && sessionId && <CopyAndVideoStep sessionId={sessionId} />}
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-neutral-600 text-sm">
        <p>Powered by AdNavigator • Built with Claude Code</p>
      </footer>
    </div>
  );
}

export default App;
