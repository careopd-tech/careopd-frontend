import React from 'react';

const LaunchScreen = ({ message = '' }) => (
  <div className="launch-screen" aria-live="polite" aria-busy="true">
    <div className="launch-screen__content">
      <img
        src="/icon_x192.png"
        alt="CareOPD"
        className="launch-screen__icon"
        width="96"
        height="96"
      />
      {message ? <p className="launch-screen__message">{message}</p> : null}
    </div>
  </div>
);

export default LaunchScreen;
