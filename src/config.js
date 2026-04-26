const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

const API_BASE_URL = isLocalHost
  ? 'http://localhost:5000' 
  : 'https://careopd-backend-hm7w.onrender.com'; // You will get this URL later

export default API_BASE_URL;