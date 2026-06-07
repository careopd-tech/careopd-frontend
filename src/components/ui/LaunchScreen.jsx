import React from 'react';

const LaunchScreen = ({
  title = 'Restoring your workspace',
  message = 'Securely reconnecting to your last session. This usually takes a moment.',
}) => (
  <div className="launch-screen" aria-live="polite" aria-busy="true">
    <div className="launch-screen__content">
      <img
        src="/CareOPD-Logo.png"
        alt="CareOPD"
        className="launch-screen__logo"
        width="188"
        height="72"
      />
      <div className="launch-screen__status" role="status" aria-label={title}>
        <p className="launch-screen__title">{title}</p>
        <p className="launch-screen__message">{message}</p>
        <div className="launch-screen__progress" aria-hidden="true">
          <span className="launch-screen__progress-bar" />
        </div>
      </div>
    </div>
  </div>
);

export default LaunchScreen;
