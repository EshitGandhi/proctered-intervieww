import React, { useState, useEffect, useRef } from 'react';

/**
 * InterviewTimer — counts down from durationMinutes.
 */
const InterviewTimer = ({ durationMinutes = 60, onExpire }) => {
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          onExpire?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [onExpire]);

  const format = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pct = remaining / (durationMinutes * 60);
  const cls = pct < 0.1 ? 'danger' : pct < 0.25 ? 'warning' : '';

  return (
    <div className={`timer ${cls}`} title={`${Math.ceil(remaining / 60)} minutes remaining`}>
      ⏱ {format(remaining)}
    </div>
  );
};

export default InterviewTimer;
