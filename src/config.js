const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://careopd-backend-hm7w.onrender.com'; // You will get this URL later

export default API_BASE_URL;