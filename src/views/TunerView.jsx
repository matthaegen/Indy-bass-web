import { useState, useEffect, useRef, useCallback } from 'react';
import { logActivity, earnMilestone } from '../db/database';
import { Mic, MicOff } from 'lucide-react';

const BASS_NOTES = [
  { name: 'E', frequency: 41.2, string: 4 },
  { name: 'A', frequency: 55.0, string: 3 },
  { name: 'D', frequency: 73.4, string: 2 },
  { name: 'G', frequency: 98.0, string: 1 },
];

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function TunerView() {
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState(null);
  const [detectedFrequency, setDetectedFrequency] = useState(null);
  const [cents, setCents] = useState(0);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafIdRef = useRef(null);

  const getNoteFromFrequency = useCallback((frequency) => {
    const noteNum = 12 * (Math.log2(frequency / 440));
    const noteIndex = Math.round(noteNum) % 12;
    const adjustedIndex = (noteIndex + 12 + 9) % 12; // A is at index 9
    const noteName = ALL_NOTES[adjustedIndex];

    // Calculate cents deviation
    const exactNote = 12 * Math.log2(frequency / 440);
    const roundedNote = Math.round(exactNote);
    const centsOff = Math.round((exactNote - roundedNote) * 100);

    return { name: noteName, cents: centsOff };
  }, []);

  const autoCorrelate = useCallback((buffer, sampleRate) => {
    const SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.01) return -1; // Not enough signal

    let r1 = 0;
    let r2 = SIZE - 1;
    const threshold = 0.2;

    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < threshold) {
        r1 = i;
        break;
      }
    }

    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < threshold) {
        r2 = SIZE - i;
        break;
      }
    }

    const buf = buffer.slice(r1, r2);
    const c = new Array(buf.length).fill(0);

    for (let i = 0; i < buf.length; i++) {
      for (let j = 0; j < buf.length - i; j++) {
        c[i] = c[i] + buf[j] * buf[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;

    let maxval = -1;
    let maxpos = -1;

    for (let i = d; i < buf.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;

    // Parabolic interpolation
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;

    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  }, []);

  const detectPitch = useCallback(() => {
    if (!analyserRef.current) return;

    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, audioContextRef.current.sampleRate);

    if (frequency > 30 && frequency < 500) {
      setDetectedFrequency(Math.round(frequency * 10) / 10);
      const noteInfo = getNoteFromFrequency(frequency);
      setDetectedNote(noteInfo.name);
      setCents(noteInfo.cents);
    }

    rafIdRef.current = requestAnimationFrame(detectPitch);
  }, [autoCorrelate, getNoteFromFrequency]);

  const startListening = async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      setIsListening(true);
      detectPitch();

      await logActivity('tuner');
      await earnMilestone('First Tune');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopListening = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsListening(false);
    setDetectedNote(null);
    setDetectedFrequency(null);
    setCents(0);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const getTuningStatus = () => {
    if (cents === 0) return 'in-tune';
    if (Math.abs(cents) <= 5) return 'close';
    return cents > 0 ? 'sharp' : 'flat';
  };

  const tuningStatus = getTuningStatus();

  return (
    <div className="tuner-view">
      <header className="view-header">
        <h1>Tuner</h1>
      </header>

      <div className="tuner-content">
        <div className="string-reference">
          <h3>Standard Bass Tuning</h3>
          <div className="strings">
            {BASS_NOTES.map(note => (
              <div
                key={note.string}
                className={`string-indicator ${detectedNote === note.name ? 'active' : ''}`}
              >
                <span className="string-number">{note.string}</span>
                <span className="string-note">{note.name}</span>
                <span className="string-freq">{note.frequency} Hz</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`tuner-display ${tuningStatus}`}>
          <div className="note-display">
            {detectedNote ? (
              <>
                <span className="detected-note">{detectedNote}</span>
                <span className="detected-freq">{detectedFrequency} Hz</span>
              </>
            ) : (
              <span className="no-signal">--</span>
            )}
          </div>

          <div className="cents-meter">
            <div className="meter-scale">
              <span>-50</span>
              <span>0</span>
              <span>+50</span>
            </div>
            <div className="meter-track">
              <div
                className="meter-indicator"
                style={{
                  left: `${50 + (cents / 50) * 50}%`,
                  opacity: detectedNote ? 1 : 0.3
                }}
              />
              <div className="meter-center" />
            </div>
            <div className="tuning-label">
              {!detectedNote && 'Play a note'}
              {detectedNote && tuningStatus === 'in-tune' && 'In Tune!'}
              {detectedNote && tuningStatus === 'close' && 'Almost there'}
              {detectedNote && tuningStatus === 'sharp' && 'Too High'}
              {detectedNote && tuningStatus === 'flat' && 'Too Low'}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          className={`listen-button ${isListening ? 'active' : ''}`}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? (
            <>
              <MicOff size={24} />
              Stop
            </>
          ) : (
            <>
              <Mic size={24} />
              Start Tuning
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TunerView;
