import React from 'react';

const FAB = ({ onClick, icon: Icon }) => (
  <button 
    onClick={onClick}
    className="fixed bottom-16 md:bottom-8 right-6 w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 hover:scale-105 transition-all flex items-center justify-center z-40"
  >
    <Icon size={20} />
  </button>
);

export default FAB;