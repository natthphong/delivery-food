import axios from 'axios';

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_EXTERNAL_API_BASE_URL || 'http://localhost:8080',
});

export default apiClient;
